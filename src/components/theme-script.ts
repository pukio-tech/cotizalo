// Módulo sin "use client": el layout (servidor) necesita el script como texto.
export const THEME_KEY = "cotizalo-theme";

/**
 * Se ejecuta en <head> antes del primer pintado: aplica la clase .dark según la preferencia
 * guardada (o la del sistema) para que no haya destello de tema incorrecto.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}")||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;
