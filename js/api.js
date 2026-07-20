export const API_URL = "https://script.google.com/macros/s/AKfycbzhFTUWw0-u9g1tbPowVjfHssIu5WLmBNJQyu6oBh329PsletwnEdIZjhiSC3iqHC36QA/exec";

/**
 * Obtiene los catálogos de filtros disponibles.
 * @returns {Promise<Object|null>} JSON con las configuraciones o null si falla.
 */
export async function get_configs() {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify({ action: "get_configs" })
        });
        
        if (!response.ok) {
            throw new Error(`Error de red HTTP: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error("Error al obtener configuraciones:", error);
        return null;
    }
}

/**
 * Busca productos aplicando los filtros especificados.
 * @param {Object} filtros - Filtros de búsqueda (nombre, tipo, version, genero).
 * @returns {Promise<Array>} Arreglo de productos o arreglo vacío si falla.
 */
export async function search(filtros = { nombre: "", tipo: "", version: "", genero: "" }) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify({ action: "search", filtros })
        });
        
        if (!response.ok) {
            throw new Error(`Error de red HTTP: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error("Error al buscar productos:", error);
        return [];
    }
}

/**
 * Autentica un cliente en el sistema.
 * @param {string} usuario - El usuario del cliente.
 * @param {string} password - La contraseña del cliente.
 * @returns {Promise<Object>} JSON con el resultado de la autenticación.
 */
export async function login_client(usuario, password) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify({ action: "login_client", usuario, password })
        });
        
        if (!response.ok) {
            throw new Error(`Error de red HTTP: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error("Error en login:", error);
        return { status: "error", message: "Error de conexión al servidor." };
    }
}
