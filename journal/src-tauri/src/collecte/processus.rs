//! Programmes ouverts et fermés : **tous** les programmes de ta session Windows, avec ou sans fenêtre
//! (applications en arrière-plan, zone de notification, utilitaires). Relevé toutes les N secondes
//! (2 par défaut), sans droits d'administrateur.
//!
//! Les processus sont regroupés par programme (même exécutable) : Chrome qui lance 20 processus compte
//! comme une seule ouverture, à l'heure du premier, et une seule fermeture, à la disparition du dernier.
//! - ouverture : heure de création du processus donnée par Windows (exacte) ;
//! - fermeture : connue entre deux relevés, notée « à ±N s ».
//! Les programmes situés dans le dossier Windows et sans fenêtre sont classés « composant » (RuntimeBroker,
//! conhost…) pour pouvoir être masqués dans le journal. Les services (session 0) et les programmes des
//! autres comptes ne sont pas suivis. Un programme lancé et fermé entre deux relevés n'est pas vu.

use super::{evenement, Ctx};
use journal_core::temps::{maintenant_ms, precision, Horodatage};
use std::collections::{HashMap, HashSet};
use std::time::Duration;

pub struct InfoProc {
    pub nom: String,
    pub chemin: Option<String>,
    /// Heure de création ; `None` si Windows refuse de la donner (processus protégé).
    pub creation_ms: Option<i64>,
}

struct Programme {
    nom: String,
    chemin: Option<String>,
    pids: HashSet<u32>,
    debut_ms: i64,
    debut_exact: bool,
    categorie: &'static str,
}

fn duree(ms: i64) -> String {
    let s = ms.max(0) / 1000;
    match s {
        s if s < 60 => format!("{s} s"),
        s if s < 3600 => format!("{} min {:02} s", s / 60, s % 60),
        s => format!("{} h {:02} min", s / 3600, (s % 3600) / 60),
    }
}

/// `fin_suivi_precedent` : fin du suivi précédent (dernière activité enregistrée), lue avant le démarrage.
pub fn demarrer(ctx: Ctx, fin_suivi_precedent: Option<i64>) {
    let mut rattrapage = fin_suivi_precedent;
    std::thread::spawn(move || {
        let windir = std::env::var("SystemRoot").unwrap_or_else(|_| r"C:\Windows".into()).to_lowercase() + "\\";
        let mut pids: HashMap<u32, (String, String)> = HashMap::new(); // pid → (nom exe, clé programme)
        let mut progs: HashMap<String, Programme> = HashMap::new();
        let mut base = true;
        loop {
            let (actif, intervalle) = {
                let r = ctx.reglages.read().unwrap();
                (r.collecte_active && r.applications, r.intervalle_processus_s.clamp(1, 60))
            };
            if !actif {
                pids.clear();
                progs.clear();
                base = true;
                std::thread::sleep(Duration::from_secs(5));
                continue;
            }
            let maintenant = maintenant_ms();
            // Au premier relevé, les programmes lancés pendant que le suivi était arrêté sont rattrapés
            // (leur heure de lancement est exacte) ; ceux déjà connus ne sont pas répétés.
            // Seulement au tout premier relevé après le lancement de l'app (pas après une désactivation).
            let rattrapage_depuis: Option<i64> = if base { rattrapage.take() } else { None };
            let liste = win::processus_de_la_session();
            let visibles = win::pids_avec_fenetre();
            let presents: HashSet<u32> = liste.iter().map(|(pid, _)| *pid).collect();

            // Processus disparus, ou identifiant réutilisé par un autre exécutable.
            let partis: Vec<u32> = pids
                .iter()
                .filter(|(pid, (nom, _))| !presents.contains(pid) || liste.iter().any(|(p, n)| p == *pid && n != nom))
                .map(|(pid, _)| *pid)
                .collect();
            for pid in partis {
                let (_, cle) = pids.remove(&pid).unwrap();
                let vide = progs.get_mut(&cle).map(|p| {
                    p.pids.remove(&pid);
                    p.pids.is_empty()
                });
                if vide == Some(true) {
                    let p = progs.remove(&cle).unwrap();
                    if !base {
                        let mut e = evenement(p.categorie, "fermeture", p.nom.clone(), Some(p.nom.clone()));
                        e.evenement = Some(Horodatage::en_local(maintenant, &format!("à ±{intervalle} s (entre deux relevés)")));
                        e.contenu.chemin = p.chemin.clone();
                        e.contenu.detail = Some(format!(
                            "Ouvert depuis {}{} (durée {})",
                            Horodatage::en_local(p.debut_ms, precision::SECONDE).lisible(),
                            if p.debut_exact { "" } else { " environ" },
                            duree(maintenant - p.debut_ms)
                        ));
                        ctx.envoyer(e);
                    }
                }
            }

            // Nouveaux processus.
            for (pid, nom) in &liste {
                if pids.contains_key(pid) {
                    continue;
                }
                let info = win::infos(*pid, nom);
                let cle = info.chemin.clone().unwrap_or_else(|| info.nom.clone()).to_lowercase();
                pids.insert(*pid, (nom.clone(), cle.clone()));
                if let Some(p) = progs.get_mut(&cle) {
                    p.pids.insert(*pid);
                    continue;
                }
                if let Some(c) = &info.chemin {
                    crate::securite::signaler_programme(c, &info.nom);
                }
                let fenetre = visibles.contains(pid);
                let dans_windows = info.chemin.as_ref().is_some_and(|c| c.to_lowercase().starts_with(&windir));
                let categorie = if dans_windows && !fenetre { "composant" } else { "application" };
                let (debut, exact) = match info.creation_ms {
                    Some(c) => (c, true),
                    None => (maintenant, false),
                };
                let signaler = !base || rattrapage_depuis.is_some_and(|d| debut > d);
                if signaler {
                    let mut e = evenement(categorie, "ouverture", info.nom.clone(), Some(info.nom.clone()));
                    e.evenement = Some(if exact {
                        Horodatage::en_local(debut, "exacte (heure de création du processus)")
                    } else {
                        Horodatage::en_local(debut, &format!("à ±{intervalle} s (heure de création refusée par Windows)"))
                    });
                    e.contenu.chemin = info.chemin.clone();
                    if !fenetre {
                        e.contenu.detail = Some("Sans fenêtre visible au lancement (arrière-plan ou zone de notification).".into());
                    }
                    if base {
                        e.contenu.note = Some("Lancé pendant que le suivi était arrêté ; heure de lancement exacte d'après Windows.".into());
                    } else if exact && maintenant - debut > (intervalle as i64 + 5) * 1000 {
                        e.contenu.note = Some("Vu après son lancement (droits insuffisants au premier relevé).".into());
                    }
                    ctx.envoyer(e);
                }
                let mut set = HashSet::new();
                set.insert(*pid);
                progs.insert(
                    cle,
                    Programme { nom: info.nom, chemin: info.chemin, pids: set, debut_ms: debut, debut_exact: exact, categorie },
                );
            }
            base = false;
            std::thread::sleep(Duration::from_secs(intervalle as u64));
        }
    });
}

#[cfg(windows)]
pub mod win {
    use super::InfoProc;
    use std::collections::HashSet;
    use windows_sys::Win32::Foundation::{CloseHandle, BOOL, FILETIME, HWND, INVALID_HANDLE_VALUE, LPARAM};
    use windows_sys::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED};
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
    };
    use windows_sys::Win32::System::RemoteDesktop::ProcessIdToSessionId;
    use windows_sys::Win32::System::Threading::{
        GetCurrentProcessId, GetProcessTimes, OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindow, GetWindowTextLengthW, GetWindowThreadProcessId, IsWindowVisible, GW_OWNER,
    };

    pub fn fenetre_principale(hwnd: HWND) -> bool {
        unsafe {
            if IsWindowVisible(hwnd) == 0 || !GetWindow(hwnd, GW_OWNER).is_null() || GetWindowTextLengthW(hwnd) == 0 {
                return false;
            }
            let mut cache: u32 = 0;
            DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED as u32, &mut cache as *mut u32 as *mut _, 4);
            cache == 0
        }
    }

    unsafe extern "system" fn rappel(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let set = &mut *(lparam as *mut HashSet<u32>);
        if fenetre_principale(hwnd) {
            let mut pid = 0u32;
            GetWindowThreadProcessId(hwnd, &mut pid);
            set.insert(pid);
        }
        1
    }

    pub fn pids_avec_fenetre() -> HashSet<u32> {
        let mut set: HashSet<u32> = HashSet::new();
        unsafe {
            EnumWindows(Some(rappel), &mut set as *mut _ as LPARAM);
        }
        set
    }

    /// Tous les processus de la session de l'utilisateur (hors cette application) : (pid, nom de l'exécutable).
    pub fn processus_de_la_session() -> Vec<(u32, String)> {
        let mut out = Vec::new();
        unsafe {
            let moi = GetCurrentProcessId();
            let mut session = 0u32;
            if ProcessIdToSessionId(moi, &mut session) == 0 {
                return out;
            }
            let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
            if snap == INVALID_HANDLE_VALUE || snap.is_null() {
                return out;
            }
            let mut e: PROCESSENTRY32W = std::mem::zeroed();
            e.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
            let mut ok = Process32FirstW(snap, &mut e);
            while ok != 0 {
                let pid = e.th32ProcessID;
                let mut s = u32::MAX;
                if pid != 0 && pid != moi && ProcessIdToSessionId(pid, &mut s) != 0 && s == session {
                    let n = e.szExeFile.iter().position(|c| *c == 0).unwrap_or(e.szExeFile.len());
                    out.push((pid, String::from_utf16_lossy(&e.szExeFile[..n])));
                }
                ok = Process32NextW(snap, &mut e);
            }
            CloseHandle(snap);
        }
        out
    }

    fn ft_ms(f: FILETIME) -> i64 {
        let t = ((f.dwHighDateTime as u64) << 32) | f.dwLowDateTime as u64;
        (t / 10_000) as i64 - 11_644_473_600_000
    }

    pub fn infos(pid: u32, nom: &str) -> InfoProc {
        unsafe {
            let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if h.is_null() {
                return InfoProc { nom: nom.to_string(), chemin: None, creation_ms: None };
            }
            let mut buf = [0u16; 1024];
            let mut n = buf.len() as u32;
            let chemin = (QueryFullProcessImageNameW(h, PROCESS_NAME_WIN32, buf.as_mut_ptr(), &mut n) != 0)
                .then(|| String::from_utf16_lossy(&buf[..n as usize]));
            let z = FILETIME { dwLowDateTime: 0, dwHighDateTime: 0 };
            let (mut c, mut e, mut k, mut u) = (z, z, z, z);
            let creation = (GetProcessTimes(h, &mut c, &mut e, &mut k, &mut u) != 0).then(|| ft_ms(c));
            CloseHandle(h);
            let nom = chemin.as_ref().and_then(|c| c.rsplit('\\').next()).unwrap_or(nom).to_string();
            InfoProc { nom, chemin, creation_ms: creation }
        }
    }

    pub fn nom_processus(pid: u32) -> Option<String> {
        let i = infos(pid, "");
        (!i.nom.is_empty()).then_some(i.nom)
    }
}

#[cfg(not(windows))]
pub mod win {
    use super::InfoProc;
    use std::collections::HashSet;
    pub fn pids_avec_fenetre() -> HashSet<u32> {
        HashSet::new()
    }
    pub fn processus_de_la_session() -> Vec<(u32, String)> {
        Vec::new()
    }
    pub fn infos(_: u32, nom: &str) -> InfoProc {
        InfoProc { nom: nom.into(), chemin: None, creation_ms: None }
    }
    pub fn nom_processus(_: u32) -> Option<String> {
        None
    }
}

#[cfg(all(test, windows))]
mod tests {
    #[test]
    fn liste_les_programmes_de_la_session() {
        let l = super::win::processus_de_la_session();
        assert!(!l.is_empty(), "aucun processus dans la session");
        let avec_heure = l.iter().filter(|(pid, n)| super::win::infos(*pid, n).creation_ms.is_some()).count();
        assert!(avec_heure > 0, "aucune heure de création lisible");
        let mut noms: Vec<&str> = l.iter().map(|(_, n)| n.as_str()).collect();
        noms.sort();
        noms.dedup();
        println!("{} processus, {} programmes, {} avec heure exacte : {:?}", l.len(), noms.len(), avec_heure, &noms[..noms.len().min(25)]);
    }
}
