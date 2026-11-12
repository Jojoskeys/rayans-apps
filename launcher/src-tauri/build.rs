fn main() {
    println!("cargo:rerun-if-changed=catalog-public-key.txt");
    println!("cargo:rerun-if-env-changed=HANGAR_DEFAULT_CATALOG_URL");
    tauri_build::build()
}
