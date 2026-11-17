//! Fenêtre active et session : notification instantanée de Windows à chaque changement de fenêtre au
//! premier plan (heure exacte), relevé du titre de la fenêtre active toutes les 2 s (changement d'onglet…),
//! verrouillage / déverrouillage de la session et signal de mise en veille / réveil.
//!
//! Seul le titre de la fenêtre est lu, filtré par les règles de secrets ; jamais son contenu ni le clavier.

use super::{evenement, systeme, Ctx};
use std::sync::OnceLock;

static CTX: OnceLock<Ctx> = OnceLock::new();

fn titre_filtre(ctx: &Ctx, appli: &str, titre: &str) -> (String, bool) {
    let r = ctx.reglages.read().unwrap();
    match r.secrets.filtrer_titre(appli, titre) {
        Some(t) => (t, false),
        None => (journal_core::texte::TITRE_MASQUE.to_string(), true),
    }
}

fn signaler_fenetre(action: &str, appli: String, titre: String) {
    let Some(ctx) = CTX.get() else { return };
    if !ctx.suivre("fenetre") {
        return;
    }
    let (t, masque) = titre_filtre(ctx, &appli, &titre);
    let mut e = evenement("fenetre", action, if t.is_empty() { appli.clone() } else { t }, Some(appli));
    if masque {
        e.contenu.note = Some("Titre non enregistré (application exclue, navigation privée ou mot sensible).".into());
    }
    ctx.envoyer(e);
}

fn signaler_session(action: &str, sujet: &str) {
    let Some(ctx) = CTX.get() else { return };
    ctx.envoyer(evenement("session", action, sujet.into(), None));
}

#[cfg(windows)]
pub fn demarrer(ctx: Ctx) {
    let _ = CTX.set(ctx);
    std::thread::spawn(|| unsafe { win::boucle() });
}

#[cfg(not(windows))]
pub fn demarrer(ctx: Ctx) {
    let _ = CTX.set(ctx);
}

#[cfg(windows)]
mod win {
    use super::*;
    use crate::collecte::processus::win::{fenetre_principale, nom_processus};
    use std::sync::Mutex;
    use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::System::SystemInformation::GetTickCount;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
    use windows_sys::Win32::System::RemoteDesktop::{WTSRegisterSessionNotification, NOTIFY_FOR_THIS_SESSION};
    use windows_sys::Win32::UI::Accessibility::{SetWinEventHook, HWINEVENTHOOK};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DispatchMessageW, GetForegroundWindow, GetMessageW, GetWindowTextW,
        GetWindowThreadProcessId, RegisterClassW, SetTimer, TranslateMessage, EVENT_SYSTEM_FOREGROUND, MSG,
        WINEVENT_OUTOFCONTEXT, WINEVENT_SKIPOWNPROCESS, WM_ENDSESSION, WM_POWERBROADCAST, WM_TIMER,
        WM_WTSSESSION_CHANGE, WNDCLASSW, WS_OVERLAPPED,
    };

    /// Dernière fenêtre signalée : (hwnd, titre brut).
    static DERNIERE: Mutex<(usize, String)> = Mutex::new((0, String::new()));

    fn large(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    unsafe fn decrire(hwnd: HWND) -> Option<(String, String)> {
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, &mut pid);
        let appli = nom_processus(pid)?;
        let mut buf = [0u16; 512];
        let n = GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
        Some((appli, String::from_utf16_lossy(&buf[..n.max(0) as usize])))
    }

    unsafe extern "system" fn sur_premier_plan(_: HWINEVENTHOOK, _ev: u32, hwnd: HWND, _: i32, _: i32, _: u32, _: u32) {
        if hwnd.is_null() {
            return;
        }
        let Some((appli, titre)) = decrire(hwnd) else { return };
        *DERNIERE.lock().unwrap() = (hwnd as usize, titre.clone());
        signaler_fenetre("premier_plan", appli, titre);
    }

    static INACTIF: Mutex<bool> = Mutex::new(false);

    /// Inactivité : seul l'instant de la dernière action clavier/souris est lu (jamais les touches).
    unsafe fn verifier_inactivite() {
        let Some(ctx) = CTX.get() else { return };
        let seuil = ctx.reglages.read().unwrap().seuil_inactivite_min.max(1) as i64 * 60_000;
        let mut li = LASTINPUTINFO { cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32, dwTime: 0 };
        if GetLastInputInfo(&mut li) == 0 {
            return;
        }
        let ecoule = GetTickCount().wrapping_sub(li.dwTime) as i64;
        let derniere_action = journal_core::temps::maintenant_ms() - ecoule;
        let mut inactif = INACTIF.lock().unwrap();
        if !*inactif && ecoule >= seuil {
            *inactif = true;
            let mut e = evenement("session", "inactif", format!("Aucune action depuis {} min", seuil / 60_000), None);
            e.evenement = Some(journal_core::Horodatage::en_local(derniere_action, "exacte (dernière action clavier ou souris)"));
            ctx.envoyer(e);
        } else if *inactif && ecoule < seuil {
            *inactif = false;
            let mut e = evenement("session", "actif", "Retour au clavier ou à la souris".into(), None);
            e.evenement = Some(journal_core::Horodatage::en_local(derniere_action, "exacte (première action clavier ou souris)"));
            ctx.envoyer(e);
        }
    }

    unsafe fn verifier_titre() {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() || !fenetre_principale(hwnd) {
            return;
        }
        let Some((appli, titre)) = decrire(hwnd) else { return };
        let mut d = DERNIERE.lock().unwrap();
        if d.0 == hwnd as usize && d.1 != titre {
            d.1 = titre.clone();
            drop(d);
            signaler_fenetre("titre", appli, titre);
        } else if d.0 != hwnd as usize {
            *d = (hwnd as usize, titre);
        }
    }

    unsafe extern "system" fn proc_fenetre(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        match msg {
            WM_TIMER => {
                verifier_titre();
                verifier_inactivite();
            }
            WM_WTSSESSION_CHANGE => match wparam {
                7 => signaler_session("verrouillage", "Session verrouillée"),
                8 => signaler_session("deverrouillage", "Session déverrouillée"),
                5 => signaler_session("ouverture_session", "Ouverture de session"),
                6 => signaler_session("fermeture_session", "Fermeture de session"),
                _ => {}
            },
            // Veille et réveil : notés depuis le journal Windows (heure exacte, même si l'app ne tournait pas).
            // Le signal sert à relire ce journal sans attendre.
            WM_POWERBROADCAST if wparam == 0x12 || wparam == 7 => {
                if let Some(ctx) = CTX.get() {
                    let c = ctx.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_secs(20));
                        systeme::rattraper(&c);
                    });
                }
            }
            WM_ENDSESSION if wparam != 0 => {
                if let Some(ctx) = CTX.get() {
                    crate::collecte::fichiers::enregistrer_etat(ctx);
                }
            }
            _ => {}
        }
        DefWindowProcW(hwnd, msg, wparam, lparam)
    }

    pub unsafe fn boucle() {
        SetWinEventHook(
            EVENT_SYSTEM_FOREGROUND,
            EVENT_SYSTEM_FOREGROUND,
            std::ptr::null_mut(),
            Some(sur_premier_plan),
            0,
            0,
            WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS,
        );
        let classe = large("RayansJournalVeilleur");
        let instance = GetModuleHandleW(std::ptr::null());
        let wc = WNDCLASSW {
            lpfnWndProc: Some(proc_fenetre),
            hInstance: instance,
            lpszClassName: classe.as_ptr(),
            ..std::mem::zeroed()
        };
        RegisterClassW(&wc);
        // Fenêtre jamais affichée (pas « message-only » : celles-ci ne reçoivent pas les signaux de veille).
        let hwnd = CreateWindowExW(
            0,
            classe.as_ptr(),
            classe.as_ptr(),
            WS_OVERLAPPED,
            0,
            0,
            0,
            0,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            instance,
            std::ptr::null(),
        );
        if !hwnd.is_null() {
            WTSRegisterSessionNotification(hwnd, NOTIFY_FOR_THIS_SESSION);
            SetTimer(hwnd, 1, 2000, None);
        }
        let mut msg: MSG = std::mem::zeroed();
        while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    }
}
