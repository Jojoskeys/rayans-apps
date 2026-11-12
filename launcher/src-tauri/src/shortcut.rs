//! Raccourcis sur le Bureau (Windows). Le raccourci ouvre Rayan's Launcher avec `--launch <id>` : le
//! lancement passe donc toujours par le launcher (version active, vérification de l'exécutable), et le
//! raccourci reste valable après une mise à jour.

use std::path::{Path, PathBuf};

/// Nom de fichier sûr pour Windows à partir du nom affiché.
pub fn file_name(name: &str) -> String {
    let clean: String = name
        .chars()
        .map(|c| if "<>:\"/\\|?*".contains(c) || c.is_control() { ' ' } else { c })
        .collect();
    let clean = clean.trim().trim_end_matches('.').trim();
    format!("{}.lnk", if clean.is_empty() { "Application" } else { clean })
}

/// Lit `--launch <id>` dans les arguments de la ligne de commande.
pub fn launch_arg(args: &[String]) -> Option<String> {
    let i = args.iter().position(|a| a == "--launch")?;
    args.get(i + 1).filter(|id| hangar_core::catalog::is_valid_id(id)).cloned()
}

#[cfg(windows)]
pub fn create(lnk: &Path, launcher: &Path, id: &str, app_exe: &Path, ico: &Path, desc: &str) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    // Les valeurs passent par des variables d'environnement : aucun texte n'est interprété par PowerShell.
    const SCRIPT: &str = r#"$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$icon = [System.Drawing.Icon]::ExtractAssociatedIcon($env:RL_EXE)
$fs = [System.IO.File]::Create($env:RL_ICO); $icon.Save($fs); $fs.Close()
$s = (New-Object -ComObject WScript.Shell).CreateShortcut($env:RL_LNK)
$s.TargetPath = $env:RL_TARGET
$s.Arguments = '--launch ' + $env:RL_ID
$s.WorkingDirectory = Split-Path -Parent $env:RL_TARGET
$s.IconLocation = $env:RL_ICO + ',0'
$s.Description = $env:RL_DESC
$s.Save()"#;
    let out = std::process::Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", SCRIPT])
        .env("RL_EXE", app_exe)
        .env("RL_ICO", ico)
        .env("RL_LNK", lnk)
        .env("RL_TARGET", launcher)
        .env("RL_ID", id)
        .env("RL_DESC", desc)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("PowerShell introuvable ({e})"))?;
    if out.status.success() && lnk.exists() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

#[cfg(not(windows))]
pub fn create(_: &Path, _: &Path, _: &str, _: &Path, _: &Path, _: &str) -> Result<(), String> {
    Err("les raccourcis sur le Bureau ne sont disponibles que sous Windows".into())
}

/// Emplacement de l'icône extraite : dans le dossier de l'application, hors des dossiers de version.
pub fn icon_path(app_dir: &Path) -> PathBuf {
    app_dir.join("raccourci.ico")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn noms_et_arguments() {
        assert_eq!(file_name("Rayan's Échecs"), "Rayan's Échecs.lnk");
        assert_eq!(file_name("A/B: C?"), "A B  C.lnk");
        assert_eq!(file_name("..."), "Application.lnk");
        let a = |v: &[&str]| v.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        assert_eq!(launch_arg(&a(&["hangar.exe", "--launch", "analyse-echecs"])).as_deref(), Some("analyse-echecs"));
        assert_eq!(launch_arg(&a(&["hangar.exe", "--launch", "../x"])), None);
        assert_eq!(launch_arg(&a(&["hangar.exe"])), None);
    }
}
