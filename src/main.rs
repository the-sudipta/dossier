fn main() {
    std::process::exit(dossier_core::cli(std::env::args().skip(1).collect()));
}
