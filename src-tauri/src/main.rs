// En Windows, oculta la consola de comandos al ejecutar el .exe.
// Mantener este atributo antes de cualquier `fn main`.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    planner_lib::run();
}