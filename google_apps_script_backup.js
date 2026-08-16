/**
 * Endpoint principal de la API que recibe todas las peticiones POST.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return construirRespuesta({ "status": "error", "message": "No se recibieron datos en el Body de la petición." });
    }

    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Ejecutar infraestructura 419 únicamente si la acción pertenece a dicha sucursal
    if (action && String(action).indexOf("419") !== -1) {
      checkAndCreate419Tables(ss);
    }
    
    // VALIDACIÓN DE SEGURIDAD (SESSION TOKENS)
    const adminActions = ["create", "update", "delete", "search_clients", "delete_client", "update_order", "save_batch_tallas"];
    if (adminActions.indexOf(action) !== -1) {
      const auth = validarToken(ss, data.token, "Administrador");
      if (auth.status === "invalid") {
        return construirRespuesta({ "status": "error", "message": auth.message, "session_invalid": true });
      }
    }
    
    if (action === "search_orders") {
      const auth = validarToken(ss, data.token, null);
      if (auth.status === "invalid") {
        return construirRespuesta({ "status": "error", "message": auth.message, "session_invalid": true });
      }
      // Forzar que el cliente sólo pueda consultar sus propios pedidos si no es administrador
      if (auth.perfil !== "Administrador") {
        if (!data.filtros) data.filtros = {};
        data.filtros.id_cliente = auth.id_cliente;
      }
    }
    
    if (action === "update_client") {
      const auth = validarToken(ss, data.token, null);
      if (auth.status === "invalid") {
        return construirRespuesta({ "status": "error", "message": auth.message, "session_invalid": true });
      }
      if (auth.perfil !== "Administrador" && String(auth.id_cliente).trim().toUpperCase() !== String(data.id_cliente).trim().toUpperCase()) {
        return construirRespuesta({ "status": "error", "message": "No tienes permisos para modificar otros perfiles." });
      }
    }
    
    const userActions = ["create_order"];
    if (userActions.indexOf(action) !== -1) {
      const auth = validarToken(ss, data.token, null);
      if (auth.status === "invalid") {
        return construirRespuesta({ "status": "error", "message": auth.message, "session_invalid": true });
      }
    }
    
    switch (action) {
      
      // ==========================================
      // ACCIÓN: OBTENER IMAGEN EN BASE64 (PROXY PARA EXCELJS)
      // ==========================================
      case "get_image_base64": {
        const url = data.url;
        if (!url) return construirRespuesta({ "status": "error", "message": "No se proporcionó la URL de la imagen." });
        try {
          const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
          if (response.getResponseCode() !== 200) {
            return construirRespuesta({ "status": "error", "message": "Error al descargar la imagen: Código " + response.getResponseCode() });
          }
          const blob = response.getBlob();
          const base64 = Utilities.base64Encode(blob.getBytes());
          const mime = blob.getContentType();
          return construirRespuesta({ "status": "success", "base64": "data:" + mime + ";base64," + base64 });
        } catch (e) {
          return construirRespuesta({ "status": "error", "message": "Error de descarga: " + e.message });
        }
      }

      // ==========================================
      // ACCIÓN 1: OBTENER CONFIGURACIONES
      // ==========================================
      case "get_configs": {
        const hojaConfigs = ss.getSheetByName("Configuraciones");
        if (!hojaConfigs) return construirRespuesta({ "status": "error", "message": "No se encontró la pestaña 'Configuraciones'." });
        
        const datos = hojaConfigs.getDataRange().getValues();
        const cabeceras = datos[0];
        
        let idxTallasHombre = -1;
        let idxTallasDama = -1;
        let idxTallasNiño = -1;
        let idxCostoTallaExtra = -1;
        let idxTallasExtra = -1;
        let idxPiezasJugadorSuper = -1;
        
        for (let c = 0; c < cabeceras.length; c++) {
          const header = String(cabeceras[c]).toLowerCase().replace(/[\s_-]/g, "");
          if (header.indexOf("talla") !== -1) {
            if (header.indexOf("hombre") !== -1) {
              idxTallasHombre = c;
            } else if (header.indexOf("dama") !== -1 || header.indexOf("mujer") !== -1) {
              idxTallasDama = c;
            } else if (header.indexOf("ni") !== -1) {
              if (idxTallasNiño === -1 || header.indexOf("unisex") !== -1) {
                idxTallasNiño = c;
              }
            } else if (header.indexOf("extra") !== -1 && header.indexOf("costo") === -1) {
              idxTallasExtra = c;
            }
          }
          if (header.indexOf("costotallaextra") !== -1 || (header.indexOf("costo") !== -1 && header.indexOf("extra") !== -1)) {
            idxCostoTallaExtra = c;
          }
          if (header.indexOf("piezasjugadormayoreosuper") !== -1 || header.indexOf("piezasjugador") !== -1 || header.indexOf("jugadormayoreosuper") !== -1) {
            idxPiezasJugadorSuper = c;
          }
        }
        
        const superMayoreoActivo = obtenerEstatusSuperMayoreo(ss);
        
        let costoExtraVal = 50;
        let tallasExtraVal = ["4XL", "5XL", "6XL"];
        
        if (idxCostoTallaExtra !== -1 && datos.length > 1 && datos[1][idxCostoTallaExtra] !== "" && datos[1][idxCostoTallaExtra] !== undefined) {
          costoExtraVal = Number(datos[1][idxCostoTallaExtra]) || 50;
        }
        if (idxTallasExtra !== -1 && datos.length > 1 && datos[1][idxTallasExtra] !== "" && datos[1][idxTallasExtra] !== undefined) {
          const rawStr = String(datos[1][idxTallasExtra]).trim();
          if (rawStr) {
            tallasExtraVal = rawStr.split(",").map(function(s) { return s.trim().toUpperCase(); }).filter(Boolean);
          }
        }

        let piezasJugadorSuperVal = 12;
        if (idxPiezasJugadorSuper !== -1 && datos.length > 1 && datos[1][idxPiezasJugadorSuper] !== "" && datos[1][idxPiezasJugadorSuper] !== undefined) {
          piezasJugadorSuperVal = Number(datos[1][idxPiezasJugadorSuper]) || 12;
        } else if (datos.length > 1) {
          for (let c = 0; c < datos[1].length; c++) {
            const valNum = Number(datos[1][c]);
            const headerStr = String(cabeceras[c] || "").toLowerCase();
            if (!isNaN(valNum) && valNum > 0 && valNum < 500 && headerStr.indexOf("costo") === -1 && headerStr.indexOf("version") === -1 && headerStr.indexOf("genero") === -1) {
              piezasJugadorSuperVal = valNum;
              break;
            }
          }
        }

        const configs = { 
          versiones: [], 
          generos: [], 
          tipos: [], 
          categorias: ["Adulto", "Niño(Unisex)"], 
          perfiles: [],         
          estatus_ordenes: [],  
          reglas_envio: [],     
          reglas_mayoreo_super: {
            "piezas_jugador": piezasJugadorSuperVal, 
            "piezas_fan": datos[1][5] !== undefined && datos[1][5] !== "" ? Number(datos[1][5]) : 0,
            "activo": superMayoreoActivo
          },
          reglas_talla_extra: {
            "costo": costoExtraVal,
            "tallas": tallasExtraVal
          },
          tallas_hombre: [],
          tallas_dama: [],
          tallas_nino: []
        };
        
        for (let i = 1; i < datos.length; i++) {
          if (datos[i][0]) configs.versiones.push(datos[i][0]);       
          if (datos[i][1]) configs.generos.push(datos[i][1]);         
          if (datos[i][2]) configs.tipos.push(datos[i][2]);           
          if (datos[i][3]) configs.perfiles.push(datos[i][3]);        
          if (datos[i][6]) configs.estatus_ordenes.push(datos[i][6]); 
          
          if (idxTallasHombre !== -1 && datos[i][idxTallasHombre] !== "" && datos[i][idxTallasHombre] !== undefined) {
            configs.tallas_hombre.push(String(datos[i][idxTallasHombre]).trim());
          }
          if (idxTallasDama !== -1 && datos[i][idxTallasDama] !== "" && datos[i][idxTallasDama] !== undefined) {
            configs.tallas_dama.push(String(datos[i][idxTallasDama]).trim());
          }
          if (idxTallasNiño !== -1 && datos[i][idxTallasNiño] !== "" && datos[i][idxTallasNiño] !== undefined) {
            configs.tallas_nino.push(String(datos[i][idxTallasNiño]).trim());
          }
          
          if (datos[i][7]) { 
            const partes = String(datos[i][7]).split(":");
            const rango = partes[0].split("-");
            configs.reglas_envio.push({
              "min_piezas": Number(rango[0]),
              "max_piezas": Number(rango[1]),
              "costo_envio": Number(partes[1])
            });
          }
        }
        
        return construirRespuesta({ "status": "success", "data": configs });
      }

      // ==========================================
      // ACCIÓN 2: BUSCAR PRODUCTOS
      // ==========================================
      case "search": {
        const origen = data.origen;
        // Los datos del jersey (foto, nombre, equipo, precios, etc.) provienen siempre de la tabla original "Playeras"
        const nombreHojaPlayeras = "Playeras";
        const nombreHojaInventario = (origen === "419") ? "Inventario_Tallas419" : "Inventario_Tallas";

        const hojaPlayeras = ss.getSheetByName(nombreHojaPlayeras);
        const hojaInventario = ss.getSheetByName(nombreHojaInventario);
        if (!hojaPlayeras || !hojaInventario) return construirRespuesta({ "status": "error", "message": "Faltan pestañas de inventario para " + nombreHojaPlayeras });

        const datosPlayeras = hojaPlayeras.getDataRange().getValues();
        const datosInventario = hojaInventario.getDataRange().getValues();
        const filtros = data.filtros || {};
        
        // Filtro por estatus activo: "1" por defecto (Solo Activos), "0" (Solo Inactivos) o "all" (Todos)
        const filtroActivo = (filtros.activo !== undefined && String(filtros.activo) !== "") ? String(filtros.activo) : "1";

        const mapaInventario = {};
        for (let j = 1; j < datosInventario.length; j++) {
          const idPlayeraInv = String(datosInventario[j][1] || "").trim().toUpperCase();
          if (idPlayeraInv) {
            if (!mapaInventario[idPlayeraInv]) mapaInventario[idPlayeraInv] = [];
            mapaInventario[idPlayeraInv].push({
              "id_inventario": datosInventario[j][0], "talla": datosInventario[j][2], "categoria": datosInventario[j][3], "stock": Number(datosInventario[j][4] || 0)
            });
          }
        }

        const resultado = [];
        for (let i = 1; i < datosPlayeras.length; i++) {
          const id = datosPlayeras[i][0]; const nombre = datosPlayeras[i][1]; const tipo = datosPlayeras[i][2]; const version = datosPlayeras[i][3]; const genero = datosPlayeras[i][4]; const personalizacion = datosPlayeras[i][5]; const foto = datosPlayeras[i][6];
          const precioMenudeo = Number(datosPlayeras[i][7] || 0); const precioMayoreo = Number(datosPlayeras[i][8] || 0); const precioMayoreoSuper = Number(datosPlayeras[i][9] || 0);
          const rawActivo = datosPlayeras[i][10];
          const activo = (rawActivo !== undefined && String(rawActivo).trim() !== "") ? Number(rawActivo) : 1;

          let personalizacionesOficiales = [];
          if (datosPlayeras[i].length >= 12 && datosPlayeras[i][11]) {
            try {
              const rawOficial = String(datosPlayeras[i][11]).trim();
              if (rawOficial.startsWith('[') || rawOficial.startsWith('{')) {
                personalizacionesOficiales = JSON.parse(rawOficial);
              }
            } catch (eOficial) {}
          }

          // Columna 13 (Índice 12): FechaRegistro
          let rawFecha = (datosPlayeras[i].length >= 13 && datosPlayeras[i][12]) ? datosPlayeras[i][12] : "";
          let fechaRegistroStr = "";
          if (rawFecha instanceof Date) {
            fechaRegistroStr = Utilities.formatDate(rawFecha, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
          } else {
            fechaRegistroStr = String(rawFecha || "").trim();
          }

          const idKey = String(id || "").trim().toUpperCase();
          const tallasAsociadas = mapaInventario[idKey] || [];

          // Filtrar según estatus Activo
          if (filtroActivo !== "all") {
            if (Number(activo) !== Number(filtroActivo)) continue;
          }

          if (filtros.nombre && !nombre.toLowerCase().includes(filtros.nombre.toLowerCase())) continue;
          if (filtros.tipo && tipo !== filtros.tipo) continue;
          if (filtros.version && version !== filtros.version) continue;
          if (filtros.genero && genero !== filtros.genero) continue;
          if (filtros.talla && !tallasAsociadas.some(t => t.talla === filtros.talla)) continue;

          resultado.push({
            "id": id, "nombre": nombre, "tipo": tipo, "version": version, "genero": genero, "personalizacion": personalizacion, "foto": foto,
            "precio_menudeo": precioMenudeo, "precio_mayoreo": precioMayoreo, "precio_mayoreo_super": precioMayoreoSuper, "activo": activo, 
            "personalizaciones_oficiales": personalizacionesOficiales, "tallas": tallasAsociadas,
            "fecha_registro": fechaRegistroStr,
            "_rowIndex": i
          });
        }

        // Ordenar por fecha_registro descendente (los más recientes primero), usando _rowIndex como criterio secundario
        resultado.sort(function(a, b) {
          if (a.fecha_registro && b.fecha_registro) {
            if (a.fecha_registro > b.fecha_registro) return -1;
            if (a.fecha_registro < b.fecha_registro) return 1;
          } else if (a.fecha_registro && !b.fecha_registro) {
            return -1;
          } else if (!a.fecha_registro && b.fecha_registro) {
            return 1;
          }
          return (b._rowIndex || 0) - (a._rowIndex || 0);
        });

        // Mostrar todos los productos ordenados por fecha de registro descendente
        return construirRespuesta({ "status": "success", "count": resultado.length, "total_registros": resultado.length, "data": resultado });
      }

      case "upload_image": {
        const base64Data = data.image_data;
        const fileName = data.file_name || "jersey_image.png";
        if (!base64Data) {
          return construirRespuesta({ "status": "error", "message": "No se recibió el base64 de la imagen." });
        }
        var folders = DriveApp.getFoldersByName("Jersey Store Images");
        var folder;
        if (folders.hasNext()) {
          folder = folders.next();
        } else {
          folder = DriveApp.createFolder("Jersey Store Images");
          folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        }
        const contentType = base64Data.substring(base64Data.indexOf(":") + 1, base64Data.indexOf(";"));
        const bytes = Utilities.base64Decode(base64Data.split(",")[1]);
        const blob = Utilities.newBlob(bytes, contentType, fileName);
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        const fileId = file.getId();
        const url = "https://lh3.googleusercontent.com/u/0/d/" + fileId;
        return construirRespuesta({ "status": "success", "url": url });
      }

      // ==========================================
      // ACCIONES CRUD ADICIONALES (3 A 11)
      // ==========================================
      case "create": {
        const hojaPlayeras = ss.getSheetByName("Playeras"); const hojaInventario = ss.getSheetByName("Inventario_Tallas");
        const idFinal = data.id || ("PLAY-" + new Date().getTime());
        
        // Verificar si la playera ya existe por su ID
        const datosPlayeras = hojaPlayeras.getDataRange().getValues();
        let existePlayera = false;
        for (let i = 1; i < datosPlayeras.length; i++) {
          if (String(datosPlayeras[i][0]).trim() === String(idFinal).trim()) {
            existePlayera = true;
            break;
          }
        }
        
        const persOficialesStr = (data.personalizaciones_oficiales && typeof data.personalizaciones_oficiales === 'object')
          ? JSON.stringify(data.personalizaciones_oficiales)
          : String(data.personalizaciones_oficiales || "");

        // Fecha de registro automática (AAAA-MM-DD HH:mm:ss)
        const fechaRegistroActual = data.fecha_registro || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

        // Solo agregar la fila en Playeras si no existe previamente (Columna 13 = FechaRegistro)
        if (!existePlayera) {
          hojaPlayeras.appendRow([
            idFinal, 
            data.nombre, 
            data.tipo, 
            data.version, 
            data.genero, 
            data.personalizacion, 
            data.foto, 
            Number(data.precio_menudeo || data.precio_menudeo || 0), 
            Number(data.precio_mayoreo || 0), 
            Number(data.precio_mayoreo_super || 0), 
            1, 
            persOficialesStr,
            fechaRegistroActual
          ]);
        }
        
        if (data.tallas) { 
          data.tallas.forEach(function(item) { 
            hojaInventario.appendRow([item.id_inventario || ("INV-" + Math.floor(Math.random() * 90000 + 10000)), idFinal, item.talla, item.categoria, Number(item.stock)]); 
          }); 
        }
        return construirRespuesta({ "status": "success", "message": "Playera procesada con éxito.", "id": idFinal });
      }
      case "update": {
        const hojaPlayeras = ss.getSheetByName("Playeras");
        if (!hojaPlayeras) return construirRespuesta({ "status": "error", "message": "No se encontró la pestaña 'Playeras'." });
        const datos = hojaPlayeras.getDataRange().getValues();
        const idBuscado = String(data.id).trim();
        let filaEncontrada = -1;
        for (let i = 1; i < datos.length; i++) {
          if (String(datos[i][0]).trim() === idBuscado) {
            filaEncontrada = i + 1;
            break;
          }
        }
        if (filaEncontrada !== -1) {
          if (data.nombre !== undefined) hojaPlayeras.getRange(filaEncontrada, 2).setValue(data.nombre);
          if (data.tipo !== undefined) hojaPlayeras.getRange(filaEncontrada, 3).setValue(data.tipo);
          if (data.version !== undefined) hojaPlayeras.getRange(filaEncontrada, 4).setValue(data.version);
          if (data.genero !== undefined) hojaPlayeras.getRange(filaEncontrada, 5).setValue(data.genero);
          if (data.personalizacion !== undefined) hojaPlayeras.getRange(filaEncontrada, 6).setValue(data.personalizacion);
          if (data.foto !== undefined) hojaPlayeras.getRange(filaEncontrada, 7).setValue(data.foto);
          if (data.precio_Menudeo !== undefined || data.precio_menudeo !== undefined) hojaPlayeras.getRange(filaEncontrada, 8).setValue(Number(data.precio_Menudeo || data.precio_menudeo || 0));
          if (data.precio_mayoreo !== undefined) hojaPlayeras.getRange(filaEncontrada, 9).setValue(Number(data.precio_mayoreo));
          if (data.precio_mayoreo_super !== undefined) hojaPlayeras.getRange(filaEncontrada, 10).setValue(Number(data.precio_mayoreo_super));
          if (data.activo !== undefined) hojaPlayeras.getRange(filaEncontrada, 11).setValue(Number(data.activo));
          if (data.personalizaciones_oficiales !== undefined) {
            const persOficialesStr = (data.personalizaciones_oficiales && typeof data.personalizaciones_oficiales === 'object') 
              ? JSON.stringify(data.personalizaciones_oficiales) 
              : String(data.personalizaciones_oficiales || "");
            hojaPlayeras.getRange(filaEncontrada, 12).setValue(persOficialesStr);
          }
          return construirRespuesta({ "status": "success", "message": "Datos de playera actualizados correctamente." });
        }
        return construirRespuesta({ "status": "error", "message": "No se encontró el producto a actualizar." });
      }
      
      // ACCIÓN: BORRADO LÓGICO / ACTIVAR / DESACTIVAR PRODUCTO
      case "delete":
      case "delete_product":
      case "toggle_product_active": {
        const hojaPlayeras = ss.getSheetByName("Playeras");
        if (!hojaPlayeras) return construirRespuesta({ "status": "error", "message": "No se encontró la pestaña 'Playeras'." });
        const datos = hojaPlayeras.getDataRange().getValues();
        const idBuscado = String(data.id || data.id_producto).trim();
        const nuevoEstado = (data.activo !== undefined) ? Number(data.activo) : 0; // 0 = Desactivado, 1 = Activo
        
        let filaEncontrada = -1;
        for (let i = 1; i < datos.length; i++) {
          if (String(datos[i][0]).trim() === idBuscado) {
            filaEncontrada = i + 1;
            break;
          }
        }
        if (filaEncontrada !== -1) {
          if (datos[0].length < 11) {
            hojaPlayeras.getRange(1, 11).setValue("Activo");
          }
          hojaPlayeras.getRange(filaEncontrada, 11).setValue(nuevoEstado);
          return construirRespuesta({ 
            "status": "success", 
            "message": nuevoEstado === 0 ? "Producto desactivado (borrado lógico)." : "Producto reactivado exitosamente.",
            "activo": nuevoEstado
          });
        }
        return construirRespuesta({ "status": "error", "message": "No se encontró el producto." });
      }
      case "traspasar_orden_a_419": {
        const res = traspasarOrdenALocal419Backend(ss, data.id_orden);
        return construirRespuesta(res);
      }
      case "update_stock_talla":
      case "update_stock": {
        const origen = data.origen;
        const nombreHojaInventario = (origen === "419") ? "Inventario_Tallas419" : "Inventario_Tallas";
        const hojaInventario = ss.getSheetByName(nombreHojaInventario);
        if (!hojaInventario) return construirRespuesta({ "status": "error", "message": "No se encontró la pestaña '" + nombreHojaInventario + "'." });
        
        const datos = hojaInventario.getDataRange().getValues();
        let filaEncontrada = -1;

        if (data.id_inventario) {
          const idBuscado = String(data.id_inventario).trim().toUpperCase();
          for (let i = 1; i < datos.length; i++) {
            if (String(datos[i][0]).trim().toUpperCase() === idBuscado) {
              filaEncontrada = i + 1;
              break;
            }
          }
        } else if (data.id_playera && data.talla) {
          const idP = String(data.id_playera).trim().toUpperCase();
          const sz = String(data.talla).trim().toUpperCase();
          for (let i = 1; i < datos.length; i++) {
            if (String(datos[i][1]).trim().toUpperCase() === idP && String(datos[i][2]).trim().toUpperCase() === sz) {
              filaEncontrada = i + 1;
              break;
            }
          }
        }

        const nuevoStock = Number(data.nuevo_stock !== undefined ? data.nuevo_stock : (data.cantidad !== undefined ? data.cantidad : 0));

        if (filaEncontrada !== -1) {
          hojaInventario.getRange(filaEncontrada, 5).setValue(nuevoStock);
          return construirRespuesta({ "status": "success", "message": "Stock actualizado correctamente." });
        } else if (data.id_playera && data.talla) {
          // Si la talla no existe en Inventario_Tallas419, crear nueva fila
          const idInvNew = (origen === "419" ? "INV419-" : "INV-") + Math.floor(Math.random() * 900000 + 100000);
          hojaInventario.appendRow([idInvNew, data.id_playera, data.talla, "Adultos", nuevoStock]);
          return construirRespuesta({ "status": "success", "message": "Registro de talla creado exitosamente." });
        } else {
          return construirRespuesta({ "status": "error", "message": "No se encontró el registro de inventario." });
        }
      }
      case "save_batch_tallas": {
        const idPlayera = String(data.id_playera || data.id || "").trim();
        if (!idPlayera) return construirRespuesta({ "status": "error", "message": "ID de playera no especificado." });

        const origen = data.origen;
        const nombreHojaInventario = (origen === "419") ? "Inventario_Tallas419" : "Inventario_Tallas";
        const hojaInventario = ss.getSheetByName(nombreHojaInventario);
        if (!hojaInventario) return construirRespuesta({ "status": "error", "message": "No se encontró la pestaña '" + nombreHojaInventario + "'." });

        const datos = hojaInventario.getDataRange().getValues();
        const itemsList = Array.isArray(data.tallas) ? data.tallas : [];
        const categoriaDefault = data.genero || "Adultos";

        // Mapear filas existentes por id_inventario y por (id_playera + talla)
        const mapaIdInv = {};
        const mapaPlayeraTalla = {};
        for (let i = 1; i < datos.length; i++) {
          const idInv = String(datos[i][0]).trim().toUpperCase();
          const idP = String(datos[i][1]).trim().toUpperCase();
          const sz = String(datos[i][2]).trim().toUpperCase();
          const numFila = i + 1;

          if (idInv) mapaIdInv[idInv] = numFila;
          if (idP && sz) mapaPlayeraTalla[idP + "___" + sz] = numFila;
        }

        itemsList.forEach(function(item) {
          const idInvItem = item.id_inventario ? String(item.id_inventario).trim().toUpperCase() : "";
          const tallaItem = item.talla ? String(item.talla).trim() : "";
          const stockItem = Number(item.stock !== undefined ? item.stock : (item.cantidad || 0));
          const isTemp = idInvItem.startsWith("TEMP_") || !idInvItem || idInvItem === "N/A";

          let filaTarget = -1;
          if (!isTemp && mapaIdInv[idInvItem]) {
            filaTarget = mapaIdInv[idInvItem];
          } else if (mapaPlayeraTalla[idPlayera.toUpperCase() + "___" + tallaItem.toUpperCase()]) {
            filaTarget = mapaPlayeraTalla[idPlayera.toUpperCase() + "___" + tallaItem.toUpperCase()];
          }

          if (filaTarget > 0) {
            // Actualizar stock existente
            hojaInventario.getRange(filaTarget, 5).setValue(stockItem);
          } else if (tallaItem) {
            // Insertar nueva talla
            const newIdInv = (origen === "419" ? "INV419-" : "INV-") + Math.floor(Math.random() * 900000 + 100000);
            const cat = item.categoria || categoriaDefault;
            hojaInventario.appendRow([newIdInv, idPlayera, tallaItem, cat, stockItem]);
          }
        });

        return construirRespuesta({ "status": "success", "message": "Todas las tallas fueron guardadas y actualizadas correctamente." });
      }
      case "delete": { return construirRespuesta({ "status": "success" }); }
      case "create_client": {
        const hojaClientes = ss.getSheetByName("Clientes");
        if (!hojaClientes) return construirRespuesta({ "status": "error", "message": "No se encontró el registro de Clientes." });
        
        const datos = hojaClientes.getDataRange().getValues();
        
        // 📞 Validar que el teléfono no esté registrado
        const telNuevo = String(data.telefono).trim().replace(/\s+/g, '');
        for (let i = 1; i < datos.length; i++) {
          const telExistente = String(datos[i][2]).trim().replace(/\s+/g, '');
          if (telExistente !== "" && telExistente === telNuevo) {
            return construirRespuesta({ "status": "error", "message": "El número de teléfono ya se encuentra registrado con otra cuenta." });
          }
        }
        
        const idCli = "CLI-" + Math.floor(Math.random() * 90000 + 10000);
        const activoVal = (data.activo !== undefined) ? Number(data.activo) : 1;
        hojaClientes.appendRow([idCli, data.nombre_completo, String(data.telefono), String(data.usuario).toLowerCase().trim(), data.password, data.perfil || "Menudeo", data.calle, String(data.numero), data.colonia, data.municipio, String(data.cp), data.referencias, activoVal]);
        return construirRespuesta({ "status": "success", "id_cliente": idCli });
      }
      case "get_client_profile": {
        const hojaClientes = ss.getSheetByName("Clientes");
        if (!hojaClientes) return construirRespuesta({ "status": "error", "message": "No se encontró el registro de Clientes." });
        
        const datos = hojaClientes.getDataRange().getValues();
        const cabeceras = datos[0];
        let idxActivo = -1;
        let idxFoto = -1;
        for (let c = 0; c < cabeceras.length; c++) {
          const h = String(cabeceras[c]).toLowerCase().trim();
          if (h === "activo" || h === "estatus" || h === "estado") idxActivo = c;
          if (h === "foto" || h === "imagen" || h === "photo") idxFoto = c;
        }
        if (idxActivo === -1) idxActivo = 12;
        if (idxFoto === -1) {
          idxFoto = cabeceras.length;
          hojaClientes.getRange(1, idxFoto + 1).setValue("foto");
        }
        
        const auth = validarToken(ss, data.token, null);
        if (auth.status === "invalid") {
          return construirRespuesta({ "status": "error", "message": auth.message, "session_invalid": true });
        }
        
        const clientStatus = verificarYActualizarExpiracionSuperMayoreo(ss, auth.id_cliente);
        
        const idBuscado = String(auth.id_cliente).trim().toUpperCase();
        for (let i = 1; i < datos.length; i++) {
          if (String(datos[i][0]).trim().toUpperCase() === idBuscado) {
            const valCelda = datos[i][idxActivo];
            const valFoto = (idxFoto !== -1 && idxFoto < datos[i].length) ? datos[i][idxFoto] : "";
            
            return construirRespuesta({
              "status": "success",
              "data": {
                "id_cliente": datos[i][0],
                "nombre_completo": datos[i][1],
                "telefono": datos[i][2],
                "usuario": datos[i][3],
                "password": datos[i][4],
                "perfil": clientStatus.perfil,
                "super_mayoreo_exp": clientStatus.exp ? String(clientStatus.exp) : "",
                "super_mayoreo_acum": clientStatus.acum || 0,
                "super_mayoreo_activo": clientStatus.super_mayoreo_activo || 0,
                "vip": (function(){ const v = String(hojaClientes.getRange(i + 1, 19).getValue()).toLowerCase().trim(); return (v==="1"||v==="1.0"||v==="si"||v==="sí"||v==="true"||v==="vip"||v==="v"||v==="x") ? 1 : (clientStatus.vip ? 1 : 0); })(),
                "calle": datos[i][6],
                "numero": datos[i][7],
                "colonia": datos[i][8],
                "municipio": datos[i][9],
                "cp": datos[i][10],
                "referencias": datos[i][11],
                "activo": (valCelda !== undefined && valCelda !== "") ? Number(valCelda) : 1,
                "foto": valFoto
              }
            });
          }
        }
        return construirRespuesta({ "status": "error", "message": "Cliente no encontrado." });
      }
      case "login_client": {
        const hojaClientes = ss.getSheetByName("Clientes"); const dt = hojaClientes.getDataRange().getValues();
        const cabeceras = dt[0];
        let idxActivo = -1;
        let idxFoto = -1;
        let idxUltimaFecha = -1;
        for (let c = 0; c < cabeceras.length; c++) {
          const h = String(cabeceras[c]).toLowerCase().trim();
          if (h === "activo" || h === "estatus" || h === "estado") idxActivo = c;
          if (h === "foto" || h === "imagen" || h === "photo") idxFoto = c;
          if (h === "ultimafechapedido" || h === "últimafechapedido" || h === "ultima_fecha_pedido" || h === "last_order_date") idxUltimaFecha = c;
        }
        if (idxActivo === -1) idxActivo = 12;
        if (idxFoto === -1) {
          idxFoto = cabeceras.length;
          hojaClientes.getRange(1, idxFoto + 1).setValue("foto");
        }
        
        for (let i = 1; i < dt.length; i++) {
          if (String(dt[i][3]).toLowerCase().trim() === String(data.usuario).toLowerCase().trim() && String(dt[i][4]) === String(data.password)) {
            const perfil = dt[i][5];
            const valCelda = dt[i][idxActivo];
            let activo = (valCelda !== undefined && valCelda !== "") ? Number(valCelda) : 1;
            
            // 🕒 Validar inactividad de 15 días desde último pedido
            if (idxUltimaFecha !== -1 && idxUltimaFecha < dt[i].length) {
              const valFechaPedido = dt[i][idxUltimaFecha];
              if (valFechaPedido && valFechaPedido !== "") {
                const fechaPedido = new Date(valFechaPedido);
                if (!isNaN(fechaPedido.getTime())) {
                  const ahora = new Date();
                  const diffDays = (ahora.getTime() - fechaPedido.getTime()) / (1000 * 60 * 60 * 24);
                  if (diffDays > 15) {
                    hojaClientes.getRange(i + 1, idxActivo + 1).setValue(0);
                    activo = 0;
                  }
                }
              }
            }
            
            if (activo === 0) {
              return construirRespuesta({ "status": "error", "message": "Tu cuenta ha sido desactivada por inactividad (más de 15 días sin realizar pedidos). Por favor, ponte en contacto con el administrador para activarla." });
            }
            
            // 🔥 VALIDAR EXPIRACIÓN DE SÚPER MAYOREO (Reutilizando matriz dt en memoria)
            const clientStatus = verificarYActualizarExpiracionSuperMayoreo(ss, dt[i][0], dt, i);
            const perfilReal = clientStatus.perfil || perfil;
            const expReal = clientStatus.exp ? String(clientStatus.exp) : "";
            const acumReal = clientStatus.acum || 0;
            
            const directVipVal = String(hojaClientes.getRange(i + 1, 19).getValue()).toLowerCase().trim();
            const directIsVip = (directVipVal === "1" || directVipVal === "1.0" || directVipVal === "si" || directVipVal === "sí" || directVipVal === "true" || directVipVal === "vip" || directVipVal === "v" || directVipVal === "x");
            
            const valFoto = (idxFoto !== -1 && idxFoto < dt[i].length) ? dt[i][idxFoto] : "";
            const token = registrarSesion(ss, dt[i][0], dt[i][3], perfilReal) || "";
            return construirRespuesta({ 
              "status": "success", 
              "data": { 
                "id_cliente": dt[i][0], 
                "nombre_completo": dt[i][1], 
                "telefono": dt[i][2],
                "usuario": dt[i][3],
                "password": dt[i][4],
                "perfil": perfilReal, 
                "super_mayoreo_exp": expReal,
                "super_mayoreo_acum": acumReal,
                "super_mayoreo_activo": clientStatus.super_mayoreo_activo || 0,
                "vip": directIsVip ? 1 : (clientStatus.vip ? 1 : 0),
                "debug_row_index": i + 1,
                "debug_val_vip_s": String(hojaClientes.getRange(i + 1, 19).getValue()),
                "debug_val_super_r": String(hojaClientes.getRange(i + 1, 18).getValue()),
                "calle": dt[i][6],
                "numero": dt[i][7],
                "colonia": dt[i][8],
                "municipio": dt[i][9],
                "cp": dt[i][10],
                "referencias": dt[i][11],
                "activo": activo, 
                "foto": valFoto,
                "token": token 
              } 
            });
          }
        }
        return construirRespuesta({ "status": "error", "message": "Credenciales inválidas" });
      }
      case "update_client": {
        const hojaClientes = ss.getSheetByName("Clientes");
        if (!hojaClientes) return construirRespuesta({ "status": "error", "message": "No se encontró el registro de Clientes." });
        const datos = hojaClientes.getDataRange().getValues();
        const idBuscado = String(data.id_cliente).trim().toUpperCase();
        let filaEncontrada = -1;
        for (let i = 1; i < datos.length; i++) {
          if (String(datos[i][0]).trim().toUpperCase() === idBuscado) {
            filaEncontrada = i + 1;
            break;
          }
        }
        if (filaEncontrada !== -1) {
          hojaClientes.getRange(filaEncontrada, 2).setValue(data.nombre_completo);
          hojaClientes.getRange(filaEncontrada, 3).setValue(String(data.telefono));
          hojaClientes.getRange(filaEncontrada, 4).setValue(String(data.usuario).toLowerCase().trim());
          hojaClientes.getRange(filaEncontrada, 5).setValue(data.password);
          hojaClientes.getRange(filaEncontrada, 6).setValue(data.perfil || "Menudeo");
          hojaClientes.getRange(filaEncontrada, 7).setValue(data.calle);
          hojaClientes.getRange(filaEncontrada, 8).setValue(String(data.numero));
          hojaClientes.getRange(filaEncontrada, 9).setValue(data.colonia);
          hojaClientes.getRange(filaEncontrada, 10).setValue(data.municipio);
          hojaClientes.getRange(filaEncontrada, 11).setValue(String(data.cp));
          hojaClientes.getRange(filaEncontrada, 12).setValue(data.referencias);
          
          const cabeceras = datos[0];
          let idxFoto = -1;
          for (let c = 0; c < cabeceras.length; c++) {
            const h = String(cabeceras[c]).toLowerCase().trim();
            if (h === "foto" || h === "imagen" || h === "photo") {
              idxFoto = c;
              break;
            }
          }
          if (idxFoto === -1) {
            idxFoto = cabeceras.length;
            hojaClientes.getRange(1, idxFoto + 1).setValue("foto");
          }
          if (data.foto !== undefined) {
            hojaClientes.getRange(filaEncontrada, idxFoto + 1).setValue(data.foto);
          }
          
          if (data.activo !== undefined) {
            let idxActivo = -1;
            for (let c = 0; c < cabeceras.length; c++) {
              const h = String(cabeceras[c]).toLowerCase().trim();
              if (h === "activo" || h === "estatus" || h === "estado") {
                idxActivo = c;
                break;
              }
            }
            if (idxActivo === -1) idxActivo = 12;
            hojaClientes.getRange(filaEncontrada, idxActivo + 1).setValue(Number(data.activo));
          }
          
          return construirRespuesta({ "status": "success", "message": "Cliente actualizado correctamente." });
        } else {
          return construirRespuesta({ "status": "error", "message": "No se encontró el cliente con ID: " + idBuscado });
        }
      }
      case "delete_client": {
        const hojaClientes = ss.getSheetByName("Clientes");
        if (!hojaClientes) return construirRespuesta({ "status": "error", "message": "No se encontró la pestaña 'Clientes'." });
        const datos = hojaClientes.getDataRange().getValues();
        const idBuscado = String(data.id_cliente).trim().toUpperCase();
        let filaEncontrada = -1;
        for (let i = 1; i < datos.length; i++) {
          if (String(datos[i][0]).trim().toUpperCase() === idBuscado) {
            filaEncontrada = i + 1;
            break;
          }
        }
        if (filaEncontrada !== -1) {
          hojaClientes.deleteRow(filaEncontrada);
          return construirRespuesta({ "status": "success", "message": "Cliente eliminado correctamente." });
        } else {
          return construirRespuesta({ "status": "error", "message": "No se encontró el cliente con ID: " + idBuscado });
        }
      }
      case "search_clients": {
        const hojaClientes = ss.getSheetByName("Clientes");
        if (!hojaClientes) return construirRespuesta({ "status": "error", "message": "No se encontró el registro de Clientes." });
        const datos = hojaClientes.getDataRange().getValues();
        const cabeceras = datos[0];
        
        let idxActivo = -1;
        let idxFoto = -1;
        let idxUltimaFecha = -1;
        let idxExp = -1;
        let idxAcum = -1;
        
        for (let c = 0; c < cabeceras.length; c++) {
          const h = String(cabeceras[c]).toLowerCase().trim();
          if (h === "activo" || h === "estatus" || h === "estado") idxActivo = c;
          if (h === "foto" || h === "imagen" || h === "photo") idxFoto = c;
          if (h === "ultimafechapedido" || h === "últimafechapedido" || h === "ultima_fecha_pedido" || h === "last_order_date") idxUltimaFecha = c;
          if (h === "supermayoreoexp" || h === "super_mayoreo_exp") idxExp = c;
          if (h === "supermayoreoacum" || h === "super_mayoreo_acum") idxAcum = c;
        }
        if (idxActivo === -1) idxActivo = 12;
        
        // Crear columnas si faltan
        if (idxExp === -1) {
          idxExp = cabeceras.length;
          hojaClientes.getRange(1, idxExp + 1).setValue("SuperMayoreoExp");
        }
        if (idxAcum === -1) {
          idxAcum = idxExp + 1;
          hojaClientes.getRange(1, idxAcum + 1).setValue("SuperMayoreoAcum");
        }
        
        const superMayoreoActivo = obtenerEstatusSuperMayoreo(ss);
        const clientes = [];
        
        for (let i = 1; i < datos.length; i++) {
          if (datos[i][0]) {
            let perfilReal = String(datos[i][5] || "Menudeo").trim();
            let expReal = (idxExp < datos[i].length) ? datos[i][idxExp] : "";
            let acumReal = (idxAcum < datos[i].length && datos[i][idxAcum] !== "") ? Number(datos[i][idxAcum]) : 0;
            
            const normPerfil = perfilReal.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            
            // Validar expiración en memoria sin bloquear la respuesta de la lista
            if (superMayoreoActivo === 0 && (normPerfil === "super mayoreo" || normPerfil === "mayoreo super")) {
              perfilReal = "Mayoreo";
              acumReal = 0;
              expReal = "";
            } else if (normPerfil === "super mayoreo" || normPerfil === "mayoreo super") {
              if (expReal) {
                try {
                  const fechaExp = new Date(expReal);
                  if (!isNaN(fechaExp.getTime()) && new Date().getTime() > fechaExp.getTime()) {
                    perfilReal = "Mayoreo";
                    acumReal = 0;
                    expReal = "";
                  }
                } catch(eExpCheck) {}
              }
            }
            
            const valCelda = datos[i][idxActivo];
            const valFoto = (idxFoto !== -1 && idxFoto < datos[i].length) ? datos[i][idxFoto] : "";
            const valUltimaFecha = (idxUltimaFecha !== -1 && idxUltimaFecha < datos[i].length) ? datos[i][idxUltimaFecha] : "";
            
            clientes.push({
              "id_cliente": datos[i][0],
              "nombre_completo": datos[i][1],
              "telefono": datos[i][2],
              "usuario": datos[i][3],
              "password": datos[i][4],
              "perfil": perfilReal, 
              "super_mayoreo_exp": expReal ? String(expReal) : "",
              "super_mayoreo_acum": acumReal || 0,
              "super_mayoreo_activo": (superMayoreoActivo === 1) ? 1 : 0,
              "calle": datos[i][6],
              "numero": datos[i][7],
              "colonia": datos[i][8],
              "municipio": datos[i][9],
              "cp": datos[i][10],
              "referencias": datos[i][11],
              "activo": (valCelda !== undefined && valCelda !== "") ? Number(valCelda) : 1,
              "foto": valFoto,
              "ultima_fecha_pedido": valUltimaFecha
            });
          }
        }
        return construirRespuesta({ "status": "success", "data": clientes });
      }

      // ==========================================
      // ACCIÓN 12: CREAR PEDIDO
      // ==========================================
      case "create_order": {
        const hojaOrdenes = ss.getSheetByName("Ordenes");
        const hojaDetalle = ss.getSheetByName("Ordenes_Detalle");
        const hojaInventario = ss.getSheetByName("Inventario_Tallas");
        const hojaConfigs = ss.getSheetByName("Configuraciones");
        const hojaPlayeras = ss.getSheetByName("Playeras");
        
        if (!hojaOrdenes || !hojaDetalle || !hojaInventario || !hojaConfigs || !hojaPlayeras) {
          return construirRespuesta({ "status": "error", "message": "Componentes del sistema no inicializados (Ordenes, Detalle, Inventario, Configs o Playeras)." });
        }
        if (!data.articulos || data.articulos.length === 0) return construirRespuesta({ "status": "error", "message": "El carrito está vacío." });

        // DEDUPLICACIÓN DE PEDIDOS (20 segundos)
        const idClienteBuscado = String(data.id_cliente || "").trim();
        const datosOrdenesExistentes = hojaOrdenes.getDataRange().getValues();
        const ahoraMs = new Date().getTime();

        if (idClienteBuscado && datosOrdenesExistentes.length > 1) {
          for (let o = datosOrdenesExistentes.length - 1; o >= Math.max(1, datosOrdenesExistentes.length - 10); o--) {
            const idCliRow = String(datosOrdenesExistentes[o][1] || "").trim();
            const fechaRow = datosOrdenesExistentes[o][2];
            
            if (idCliRow === idClienteBuscado) {
              let msDiff = 999999;
              if (fechaRow instanceof Date) {
                msDiff = Math.abs(ahoraMs - fechaRow.getTime());
              } else if (fechaRow) {
                try { msDiff = Math.abs(ahoraMs - new Date(fechaRow).getTime()); } catch (e) {}
              }
              
              if (msDiff < 20000) {
                const idOrdenExistente = datosOrdenesExistentes[o][0];
                return construirRespuesta({ 
                  "status": "success", 
                  "id_orden": idOrdenExistente, 
                  "gran_total_playeras": Number(datosOrdenesExistentes[o][3] || 0), 
                  "costo_envio": Number(datosOrdenesExistentes[o][7] || 0), 
                  "total_neto": Number(datosOrdenesExistentes[o][8] || datosOrdenesExistentes[o][3] || 0),
                  "duplicado_prevenido": true
                });
              }
            }
          }
        }

        SpreadsheetApp.flush();
        const datosInventario = hojaInventario.getDataRange().getValues();
        const datosPlayeras = hojaPlayeras.getDataRange().getValues();
        
        const mapaNombresPlayeras = {};
        for (let p = 1; p < datosPlayeras.length; p++) {
          mapaNombresPlayeras[String(datosPlayeras[p][0]).trim().toUpperCase()] = datosPlayeras[p][1];
        }

        // VALIDAR STOCK DISPONIBLE
        const conflictos = [];
        for (let idx = 0; idx < data.articulos.length; idx++) {
          const item = data.articulos[idx];
          const idInventarioOriginal = item.id_inventario || item.IdInventario || item.idInventario || "";
          const idInventarioBuscado = String(idInventarioOriginal).toUpperCase().trim();
          const cantidad = Number(item.cantidad || 1);
          
          let stockActual = 0;
          let idProducto = item.id_producto || "Desconocido";
          let talla = item.talla || "";
          let encontrado = false;
          
          for (let j = 1; j < datosInventario.length; j++) {
            const idCeldaStock = String(datosInventario[j][0]).toUpperCase().trim();
            if (idCeldaStock === idInventarioBuscado && idCeldaStock !== "") {
              stockActual = Number(datosInventario[j][4]); // Col E: Stock
              idProducto = datosInventario[j][1];
              talla = datosInventario[j][2];
              encontrado = true;
              break;
            }
          }
          
          if (encontrado && stockActual < cantidad) {
            const nombreProd = mapaNombresPlayeras[String(idProducto).toUpperCase().trim()] || "Playera";
            conflictos.push({
              "id_inventario": idInventarioOriginal,
              "nombre": nombreProd,
              "talla": talla,
              "solicitado": cantidad,
              "disponible": stockActual
            });
          }
        }
        
        if (conflictos.length > 0) {
          return construirRespuesta({ "status": "stock_conflict", "conflictos": conflictos });
        }

        const idOrdenNueva = "ORD-" + new Date().getTime();
        const fechaActual = new Date();
        let granTotalPrendas = 0; let totalPiezasPedido = 0;

        const datosDetalleRaw = hojaDetalle.getDataRange().getValues();
        const encabezadosDet = (datosDetalleRaw && datosDetalleRaw.length > 0 && datosDetalleRaw[0].length > 0) 
          ? datosDetalleRaw[0] 
          : ["IdDetalle", "IdOrden", "IdProducto", "Talla", "Cantidad", "IdPersonalizacion", "TextoPersonalizado", "PrecioUnitario", "Subtotal"];
        
        let idxIdInv = encabezadosDet.indexOf("IdInventario");
        if (idxIdInv === -1) {
          idxIdInv = encabezadosDet.length;
          try { hojaDetalle.getRange(1, idxIdInv + 1).setValue("IdInventario"); } catch (eH1) {}
          encabezadosDet.push("IdInventario");
        }
        
        let idxEstatusDet = encabezadosDet.indexOf("EstatusOrdenDetalle");
        if (idxEstatusDet === -1) {
          idxEstatusDet = encabezadosDet.length;
          try { hojaDetalle.getRange(1, idxEstatusDet + 1).setValue("EstatusOrdenDetalle"); } catch (eH2) {}
          encabezadosDet.push("EstatusOrdenDetalle");
        }

        data.articulos.forEach(function(item) {
          const idInventarioOriginal = item.id_inventario || item.IdInventario || item.idInventario || "";
          const idInventarioBuscado = String(idInventarioOriginal).toUpperCase().trim();
          
          const cantidad = Number(item.cantidad || 1);
          const precioUnitario = Number(item.precio_unitario_final || 0);
          const subtotalRenglon = cantidad * precioUnitario;
          granTotalPrendas += subtotalRenglon; totalPiezasPedido += cantidad;

          let filaInventarioEncontrada = -1; let stockActual = 0; 
          let idProducto = item.id_producto || item.idProducto || item.idProductoOriginal || "Desconocido";
          let talla = item.talla || item.Talla || "";

          for (let j = 1; j < datosInventario.length; j++) {
            const idCeldaStock = String(datosInventario[j][0]).toUpperCase().trim();
            if (idCeldaStock === idInventarioBuscado && idCeldaStock !== "") {
              filaInventarioEncontrada = j + 1; 
              stockActual = Number(datosInventario[j][4]);
              idProducto = datosInventario[j][1];
              talla = datosInventario[j][2];
              break;
            }
          }

          if (filaInventarioEncontrada !== -1) {
            hojaInventario.getRange(filaInventarioEncontrada, 5).setValue(Math.max(0, stockActual - cantidad));
          }

          const idDetalle = "DET-" + Math.floor(Math.random() * 90000 + 10000);
          
          const nuevaFilaDetalle = [];
          for (let k = 0; k < encabezadosDet.length; k++) {
            nuevaFilaDetalle.push("");
          }
          nuevaFilaDetalle[0] = idDetalle;
          nuevaFilaDetalle[1] = idOrdenNueva;
          nuevaFilaDetalle[2] = idProducto;
          nuevaFilaDetalle[3] = talla;
          nuevaFilaDetalle[4] = cantidad;
          nuevaFilaDetalle[5] = item.id_personalizacion || "PERS-001";
          nuevaFilaDetalle[6] = item.texto_personalizado || "";
          nuevaFilaDetalle[7] = precioUnitario;
          nuevaFilaDetalle[8] = subtotalRenglon;
          
          if (idxIdInv !== -1) {
            nuevaFilaDetalle[idxIdInv] = idInventarioOriginal;
          }
          if (idxEstatusDet !== -1) {
            nuevaFilaDetalle[idxEstatusDet] = 1;
          }
          
          hojaDetalle.appendRow(nuevaFilaDetalle);
        });

        let requiereEnvio = "No";
        if (data.envio === true || String(data.envio).toLowerCase().trim() === "sí" || String(data.envio).toLowerCase().trim() === "si" || data.tipo_entrega === "Domicilio") {
          requiereEnvio = "Sí";
        }

        let cargoEnvio = 0;
        if (requiereEnvio === "Sí") {
          cargoEnvio = 70;
          try {
            const dtC = hojaConfigs.getDataRange().getValues();
            for (let i = 1; i < dtC.length; i++) {
              if (dtC[i][7] && String(dtC[i][7]).indexOf(":") !== -1) {
                const partes = String(dtC[i][7]).split(":"); 
                const rango = partes[0].split("-");
                if (rango.length >= 2 && totalPiezasPedido >= Number(rango[0]) && totalPiezasPedido <= Number(rango[1])) { 
                  cargoEnvio = Number(partes[1]) || 0; 
                  break; 
                }
              }
            }
          } catch (eEnv) {}
        }

        const sumaTotalFinal = granTotalPrendas + cargoEnvio;
        hojaOrdenes.appendRow([idOrdenNueva, data.id_cliente, fechaActual, granTotalPrendas, data.tipo_precio_aplicado || "Menudeo", "Pendiente", requiereEnvio, cargoEnvio, sumaTotalFinal]);
        
        // 🔄 Actualizar UltimaFechaPedido en Clientes
        const hojaClientes = ss.getSheetByName("Clientes");
        let nuevoPerfil = "";
        let nuevaExpDate = "";
        let nuevoAcum = 0;
        let clientStatusPre = null;
        
        if (hojaClientes) {
          try {
            const datosCli = hojaClientes.getDataRange().getValues();
            const cabecerasCli = datosCli[0];
            let idxUltimaFecha = -1;
            for (let c = 0; c < cabecerasCli.length; c++) {
              const h = String(cabecerasCli[c]).toLowerCase().trim();
              if (h === "ultimafechapedido" || h === "últimafechapedido" || h === "ultima_fecha_pedido" || h === "last_order_date") {
                idxUltimaFecha = c;
                break;
              }
            }
            if (idxUltimaFecha === -1) {
              idxUltimaFecha = cabecerasCli.length;
              try { hojaClientes.getRange(1, idxUltimaFecha + 1).setValue("UltimaFechaPedido"); } catch (eF) {}
            }
            
            const idCliBuscado = String(data.id_cliente).trim().toUpperCase();
            let rowCliTarget = -1;
            for (let row = 1; row < datosCli.length; row++) {
              if (String(datosCli[row][0]).trim().toUpperCase() === idCliBuscado) {
                rowCliTarget = row + 1;
                try { hojaClientes.getRange(rowCliTarget, idxUltimaFecha + 1).setValue(fechaActual); } catch (eF2) {}
                break;
              }
            }
            
            // 🔄 Solo revalidar estatus actual de expiración y UltimaFechaPedido al crear la orden (NO cambiar perfil ni asignar expiración hasta que el Administrador apruebe el estatus)
            clientStatusPre = verificarYActualizarExpiracionSuperMayoreo(ss, data.id_cliente);
            if (clientStatusPre) {
              nuevoPerfil = clientStatusPre.perfil || "";
              nuevaExpDate = clientStatusPre.exp || "";
              nuevoAcum = clientStatusPre.acum || 0;
            }
          } catch (eCliErr) {
            Logger.log("Error al actualizar estado cliente en orden: " + eCliErr.message);
          }
        }
        
        try { SpreadsheetApp.flush(); } catch (eFl) {}
        return construirRespuesta({ 
          "status": "success", 
          "id_orden": idOrdenNueva, 
          "gran_total_playeras": granTotalPrendas, 
          "costo_envio": cargoEnvio, 
          "total_neto": sumaTotalFinal
        });
      }

      // ==========================================
      // ACCIÓN 13: BUSCAR HISTORIAL DE ÓRDENES
      // ==========================================
      case "search_orders": {
        const hojaOrdenes = ss.getSheetByName("Ordenes");
        const hojaDetalle = ss.getSheetByName("Ordenes_Detalle");
        const hojaClientes = ss.getSheetByName("Clientes");
        const hojaPlayeras = ss.getSheetByName("Playeras");
        const hojaInventario = ss.getSheetByName("Inventario_Tallas");

        const datosOrdenes = hojaOrdenes.getDataRange().getValues();
        const datosDetalle = hojaDetalle.getDataRange().getValues();
        const datosClientes = hojaClientes.getDataRange().getValues();
        const datosPlayeras = hojaPlayeras.getDataRange().getValues();
        const datosInventario = hojaInventario.getDataRange().getValues();
        const filtros = data.filtros || {};

        const mapaClientes = {};
        for (let c = 1; c < datosClientes.length; c++) { mapaClientes[String(datosClientes[c][0]).trim()] = { "nombre": datosClientes[c][1], "telefono": datosClientes[c][2] }; }
        
        const mapaPlayeras = {};
        for (let p = 1; p < datosPlayeras.length; p++) { 
          mapaPlayeras[String(datosPlayeras[p][0]).trim()] = { 
            "id": datosPlayeras[p][0], 
            "nombre": datosPlayeras[p][1], 
            "foto": datosPlayeras[p][6],
            "genero": datosPlayeras[p][4],
            "tipo": datosPlayeras[p][2],
            "version": datosPlayeras[p][3]
          }; 
        }

        const mapaInventarioAPlayera = {};
        for (let j = 1; j < datosInventario.length; j++) {
          mapaInventarioAPlayera[String(datosInventario[j][0]).trim()] = String(datosInventario[j][1]).trim();
        }

        const idsOrdenesValidas = {};
        const tieneFiltros = (filtros.id_orden || filtros.id_cliente) ? true : false;
        if (tieneFiltros) {
          for (let o = 1; o < datosOrdenes.length; o++) {
            const idOrden = datosOrdenes[o][0];
            const idCliente = String(datosOrdenes[o][1]).trim();
            if (filtros.id_orden && idOrden !== filtros.id_orden) continue;
            if (filtros.id_cliente && idCliente !== String(filtros.id_cliente).trim()) continue;
            idsOrdenesValidas[idOrden] = true;
          }
        }

        const mapaDetalles = {};
        const idxEstatusDet = datosDetalle[0].indexOf("EstatusOrdenDetalle");
        for (let d = 1; d < datosDetalle.length; d++) {
          if (idxEstatusDet !== -1 && String(datosDetalle[d][idxEstatusDet]).trim() === "0") {
            continue;
          }
          
          const idOrdDet = datosDetalle[d][1];
          if (tieneFiltros && !idsOrdenesValidas[idOrdDet]) {
            continue;
          }
          
          if (!mapaDetalles[idOrdDet]) mapaDetalles[idOrdDet] = [];
          
          let valPlayera = String(datosDetalle[d][2]).trim();
          if (valPlayera.toUpperCase().startsWith("INV-")) {
            valPlayera = mapaInventarioAPlayera[valPlayera] || valPlayera;
          }

          mapaDetalles[idOrdDet].push({
            "id_detalle": datosDetalle[d][0], 
            "id_playera": mapaPlayeras[valPlayera] || { "id": valPlayera, "nombre": "Playera Desconocida", "foto": "", "genero": "-", "tipo": "-", "version": "-" }, 
            "talla": datosDetalle[d][3], 
            "cantidad": Number(datosDetalle[d][4]),
            "id_personalizacion": datosDetalle[d][5] || "PERS-NONE",
            "texto_personalizado": datosDetalle[d][6], 
            "precio_unitario_final": Number(datosDetalle[d][7]), 
            "subtotal_renglon": Number(datosDetalle[d][8])
          });
        }

        const encabezadosOrd = datosOrdenes[0];
        let idxOrdGuia = -1;
        for (let j = 0; j < encabezadosOrd.length; j++) {
          if (String(encabezadosOrd[j]).trim().toLowerCase() === "guia") {
            idxOrdGuia = j;
            break;
          }
        }

        const resultadoOrdenes = [];
        for (let o = 1; o < datosOrdenes.length; o++) {
          const idOrden = String(datosOrdenes[o][0] || "").trim();
          if (!idOrden) continue;
          
          const idCliente = String(datosOrdenes[o][1] || "").trim();
          const objetoCliente = mapaClientes[idCliente] || { "nombre": "Cliente Desconocido", "telefono": "" };

          if (filtros.id_orden && idOrden !== String(filtros.id_orden).trim()) continue;
          if (filtros.id_cliente && idCliente !== String(filtros.id_cliente).trim()) continue;

          const rawFecha = datosOrdenes[o][2];
          let fechaStr = "";
          if (rawFecha instanceof Date) {
            fechaStr = Utilities.formatDate(rawFecha, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
          } else {
            fechaStr = String(rawFecha || "").trim();
          }

          const guiaVal = (idxOrdGuia !== -1 && idxOrdGuia < datosOrdenes[o].length) ? String(datosOrdenes[o][idxOrdGuia] || "").trim() : "";

          resultadoOrdenes.push({
            "id_orden": idOrden, 
            "id_cliente": idCliente, 
            "nombre_cliente": String(objetoCliente.nombre || "Cliente").trim(), 
            "telefono_cliente": String(objetoCliente.telefono || "").trim(), 
            "fecha": fechaStr, 
            "gran_total": Number(datosOrdenes[o][3] || 0), 
            "tipo_precio_aplicado": String(datosOrdenes[o][4] || "Mayoreo").trim(), 
            "estatus": String(datosOrdenes[o][5] || "Pendiente").trim(), 
            "envio_solicitado": String(datosOrdenes[o][6] || "No").trim(), 
            "envio_costo": Number(datosOrdenes[o][7] || 0), 
            "total_neto": Number(datosOrdenes[o][8] || datosOrdenes[o][3] || 0), 
            "guia": guiaVal,
            "articulos_carrito": mapaDetalles[idOrden] || []
          });
        }
        return construirRespuesta({ "status": "success", "data": resultadoOrdenes });
      }

      case "update_order_status": { 
        const hojaOrdenes = ss.getSheetByName("Ordenes"); 
        if (!hojaOrdenes) return construirRespuesta({ "status": "error", "message": "No se encontró la hoja Ordenes." });
        const dt = hojaOrdenes.getDataRange().getValues();
        const encabezados = dt[0];
        
        let idxGuia = -1;
        for (let j = 0; j < encabezados.length; j++) {
          if (String(encabezados[j]).trim().toLowerCase() === "guia") {
            idxGuia = j;
            break;
          }
        }
        
        for(let i=1; i<dt.length; i++) { 
          if(String(dt[i][0]).trim() === String(data.id_orden).trim()) { 
            hojaOrdenes.getRange(i+1, 6).setValue(data.nuevo_estatus); 
            if (data.guia !== undefined && idxGuia !== -1) {
              hojaOrdenes.getRange(i+1, idxGuia + 1).setValue(data.guia);
            }
            break; 
          } 
        }

        // 🌟 Validar y procesar Súper Mayoreo al cambiar estatus
        const resSuperMayoreo = procesarSuperMayoreoAlCambiarEstatus(ss, data.id_orden, data.nuevo_estatus);

        return construirRespuesta({ 
          "status": "success", 
          "message": "Estatus de la orden actualizado correctamente.",
          "super_mayoreo_procesado": resSuperMayoreo 
        }); 
      }
      case "get_personalizations": { return construirRespuesta({ "status": "success", "data": [] }); }

      // ==========================================
      // ACCIÓN 16: ELIMINAR ITEM
      // ==========================================
      case "delete_order_item": {
        const hojaOrdenes = ss.getSheetByName("Ordenes");
        const hojaDetalle = ss.getSheetByName("Ordenes_Detalle");
        const hojaInventario = ss.getSheetByName("Inventario_Tallas");
        const hojaConfigs = ss.getSheetByName("Configuraciones");

        if (!hojaOrdenes || !hojaDetalle || !hojaInventario || !hojaConfigs) return construirRespuesta({ "status": "error", "message": "Faltan componentes esenciales." });
        const idDetalleBuscado = data.id_detalle;
        if (!idDetalleBuscado) return construirRespuesta({ "status": "error", "message": "Falta id_detalle." });

        let datosDetalle = hojaDetalle.getDataRange().getValues();
        const idxIdInv = datosDetalle[0].indexOf("IdInventario");
        if (idxIdInv === -1) return construirRespuesta({ "status": "error", "message": "No se localizó la columna 'IdInventario' en Ordenes_Detalle." });

        let filaDetalle = -1; let idOrdenAsociada = ""; let cantidadAAgregar = 0; let idInventarioAsociado = "";

        for (let d = 1; d < datosDetalle.length; d++) {
          if (String(datosDetalle[d][0]).trim() === String(idDetalleBuscado).trim()) {
            filaDetalle = d + 1; idOrdenAsociada = datosDetalle[d][1]; cantidadAAgregar = Number(datosDetalle[d][4]); 
            idInventarioAsociado = String(datosDetalle[d][idxIdInv]).toUpperCase().trim(); break;
          }
        }
        if (filaDetalle === -1) return construirRespuesta({ "status": "error", "message": "Artículo no localizado." });
        
        // Devolver las piezas al stock usando IdInventario
        const datosInventario = hojaInventario.getDataRange().getValues();
        for (let j = 1; j < datosInventario.length; j++) {
          const idCeldaStock = String(datosInventario[j][0]).toUpperCase().trim();
          if (idCeldaStock === idInventarioAsociado && idCeldaStock !== "") {
            hojaInventario.getRange(j + 1, 5).setValue(Number(datosInventario[j][4]) + cantidadAAgregar); break;
          }
        }

        let idxEstatusDet = datosDetalle[0].indexOf("EstatusOrdenDetalle");
        if (idxEstatusDet === -1) {
          hojaDetalle.getRange(1, datosDetalle[0].length + 1).setValue("EstatusOrdenDetalle");
          idxEstatusDet = datosDetalle[0].length;
          datosDetalle = hojaDetalle.getDataRange().getValues();
        }

        hojaDetalle.getRange(filaDetalle, idxEstatusDet + 1).setValue(0);
        
        datosDetalle = hojaDetalle.getDataRange().getValues();
        let piezasRestantesTotal = 0; let dineroRestantePrendas = 0;
        for (let d = 1; d < datosDetalle.length; d++) {
          if (String(datosDetalle[d][1]).trim() === String(idOrdenAsociada).trim()) {
            let estatusDetalle = 1;
            if (idxEstatusDet !== -1 && datosDetalle[d][idxEstatusDet] !== "") {
              estatusDetalle = Number(datosDetalle[d][idxEstatusDet]);
            }
            if (estatusDetalle !== 0) {
              piezasRestantesTotal += Number(datosDetalle[d][4]); 
              dineroRestantePrendas += Number(datosDetalle[d][8]); 
            }
          }
        }

        const datosOrdenes = hojaOrdenes.getDataRange().getValues();
        let filaOrden = -1; for (let o = 1; o < datosOrdenes.length; o++) { if (String(datosOrdenes[o][0]).trim() === String(idOrdenAsociada).trim()) { filaOrden = o + 1; break; } }

        if (filaOrden !== -1) {
          if (piezasRestantesTotal === 0) { 
            hojaOrdenes.getRange(filaOrden, 6).setValue("Cancelada"); 
            hojaOrdenes.getRange(filaOrden, 4).setValue(0);
            hojaOrdenes.getRange(filaOrden, 8).setValue(0);
            hojaOrdenes.getRange(filaOrden, 9).setValue(0);
            return construirRespuesta({ "status": "success", "message": "Pedido cancelado automáticamente al no quedar artículos activos.", "orden_vaciada": true }); 
          }
          
          let nuevoEnvio = 0; 
          if (datosOrdenes[filaOrden - 1][6] === "Sí") {
            nuevoEnvio = 70; const dtC = hojaConfigs.getDataRange().getValues();
            for (let i = 1; i < dtC.length; i++) { 
              if (dtC[i][7]) { 
                const partes = String(dtC[i][7]).split(":"); const rango = partes[0].split("-"); if (piezasRestantesTotal >= Number(rango[0]) && piezasRestantesTotal <= Number(rango[1])) { nuevoEnvio = Number(partes[1]); break; } 
              } 
            }
          }
          hojaOrdenes.getRange(filaOrden, 4).setValue(dineroRestantePrendas);
          hojaOrdenes.getRange(filaOrden, 8).setValue(nuevoEnvio);
          hojaOrdenes.getRange(filaOrden, 9).setValue(dineroRestantePrendas + nuevoEnvio);
        }
        
        SpreadsheetApp.flush();
        return construirRespuesta({ "status": "success", "message": "Artículo removido.", "orden_vaciada": false });
      }

      // ==========================================
      // ACCIÓN 17: BYPASS SEGURO
      // ==========================================
      case "update_order_item_quantity": {
        const nuevaCantidad = data.nueva_cantidad !== undefined ? Number(data.nueva_cantidad) : null;
        if (nuevaCantidad === 0 || nuevaCantidad === null) {
          return ejecutarBypassBorradoDirecto(ss, data);
        }
        return construirRespuesta({ "status": "error", "message": "Los artículos no pueden editarse en volumen directo. Presiona el bote de basura para eliminar." });
      }

      // ==========================================
      // ACCIÓN: GUARDAR PEDIDO A PROVEEDOR
      // ==========================================
      case "save_supplier_order": {
        let sheet = ss.getSheetByName("PedidosProveedor") || ss.getSheetByName("Pedidos_Proveedor") || ss.getSheetByName("Pedidos Proveedor");
        if (!sheet) {
          sheet = ss.insertSheet("PedidosProveedor");
          sheet.appendRow(["id_pedido_proveedor", "NoFoto", "fecha", "id_producto", "equipo", "foto", "remark", "talla", "cantidad", "nombre", "numero", "parche", "estatus"]);
        }
        
        const folio = data.id_pedido_proveedor || ("PROV-" + (new Date()).getTime());
        const fecha = data.fecha || Utilities.formatDate(new Date(), "America/Mexico_City", "dd/MM/yyyy hh:mm:ss a");
        const items = data.items || [];
        
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          sheet.appendRow([
            folio,
            Number(item.no_foto || (i + 1)),
            fecha,
            item.id_producto || "",
            item.equipo || item.remark || "",
            item.foto || "",
            item.remark || "",
            item.size || "",
            Number(item.qty) || 0,
            item.name || "",
            item.number || "",
            item.patch || "",
            "Pendiente"
          ]);
        }
        
        return construirRespuesta({ "status": "success", "message": "Pedido guardado en Google Sheets con folio " + folio, "folio": folio });
      }

      // ==========================================
      // ACCIÓN: OBTENER PEDIDOS A PROVEEDOR
      // ==========================================
      case "get_supplier_orders": {
        const sheet = ss.getSheetByName("PedidosProveedor") || ss.getSheetByName("Pedidos_Proveedor") || ss.getSheetByName("Pedidos Proveedor");
        if (!sheet) return construirRespuesta({ "status": "success", "orders": [] });
        
        const rows = sheet.getDataRange().getValues();
        if (rows.length <= 1) return construirRespuesta({ "status": "success", "orders": [] });
        
        const ordersMap = {};
        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          const folio = String(row[0] || "").trim();
          if (!folio) continue;
          
          const estatusRow = String(row[12] || "Pendiente").trim();
          
          if (!ordersMap[folio]) {
            ordersMap[folio] = {
              id_pedido_proveedor: folio,
              fecha: row[2],
              estatus: estatusRow,
              total_piezas: 0,
              items: []
            };
          }
          
          const qty = Number(row[8]) || 0;
          ordersMap[folio].total_piezas += qty;
          
          ordersMap[folio].items.push({
            row_index: r + 1,
            no_foto: Number(row[1]) || 1,
            id_producto: row[3],
            equipo: row[4],
            foto: row[5],
            remark: row[6],
            size: row[7],
            qty: qty,
            name: row[9],
            number: row[10],
            patch: row[11],
            estatus: estatusRow
          });
        }
        
        const ordersList = Object.keys(ordersMap).map(function(k) {
          const ord = ordersMap[k];
          let totalPending = 0;
          let hasMigratedAny = false;
          
          for (let i = 0; i < ord.items.length; i++) {
            const it = ord.items[i];
            if (it.estatus === "Ingresado a Stock") {
              hasMigratedAny = true;
            } else {
              totalPending += it.qty;
              if (it.estatus === "Parcial") hasMigratedAny = true;
            }
          }
          
          if (totalPending <= 0) {
            ord.estatus = "Ingresado a Stock";
          } else if (hasMigratedAny) {
            ord.estatus = "Parcial";
          } else {
            ord.estatus = "Pendiente";
          }
          
          return ord;
        });
        
        return construirRespuesta({ "status": "success", "orders": ordersList });
      }

      // ==========================================
      // ACCIÓN: MIGRAR PEDIDO A PROVEEDOR AL STOCK
      // ==========================================
      case "migrate_supplier_order_to_stock": {
        let supplierSheet = ss.getSheetByName("PedidosProveedor") || ss.getSheetByName("Pedidos_Proveedor") || ss.getSheetByName("Pedidos Proveedor");
        if (!supplierSheet) {
          supplierSheet = ss.insertSheet("PedidosProveedor");
          supplierSheet.appendRow(["id_pedido_proveedor", "NoFoto", "fecha", "id_producto", "equipo", "foto", "remark", "talla", "cantidad", "nombre", "numero", "parche", "estatus"]);
        }
        
        const assignments = data.assignments || [];
        const folio = String(data.id_pedido_proveedor || "").trim();
        
        const hojaInventarioTallas = ss.getSheetByName("Inventario_Tallas") || ss.getSheetByName("InventarioTallas") || ss.getSheetByName("Stock_Tallas");
        const catalogSheet = ss.getSheetByName("Catalogo") || ss.getSheetByName("Catálogo") || ss.getSheetByName("Playeras") || ss.getSheetByName("Productos") || ss.getSheetByName("Inventario");
        
        for (let a = 0; a < assignments.length; a++) {
          const assign = assignments[a];
          const targetId = String(assign.id_producto).trim().toUpperCase();
          const tallasRec = assign.tallas_received || assign.tallas || {};
          
          Object.keys(tallasRec).forEach(function(tallaKey) {
            const addVal = Number(tallasRec[tallaKey]) || 0;
            if (addVal <= 0) return;
            const targetTalla = String(tallaKey).trim().toUpperCase();
            
            if (hojaInventarioTallas) {
              const invData = hojaInventarioTallas.getDataRange().getValues();
              let encontradoInv = false;
              for (let i = 1; i < invData.length; i++) {
                const rowProdId = String(invData[i][1]).trim().toUpperCase();
                const rowTalla = String(invData[i][2]).trim().toUpperCase();
                if (rowProdId === targetId && rowTalla === targetTalla) {
                  const currentStock = Number(invData[i][4]) || 0;
                  hojaInventarioTallas.getRange(i + 1, 5).setValue(currentStock + addVal);
                  encontradoInv = true;
                  break;
                }
              }
              if (!encontradoInv) {
                const newInvId = "INV-" + Math.floor(Math.random() * 90000 + 10000);
                hojaInventarioTallas.appendRow([newInvId, targetId, tallaKey, "Hombre", addVal]);
              }
            }
            
            if (catalogSheet) {
              const catalogData = catalogSheet.getDataRange().getValues();
              const catalogHeaders = catalogData[0];
              for (let c = 1; c < catalogData.length; c++) {
                const prodId = String(catalogData[c][0]).trim().toUpperCase();
                if (prodId === targetId) {
                  for (let colIdx = 0; colIdx < catalogHeaders.length; colIdx++) {
                    const headerName = String(catalogHeaders[colIdx]).trim().toUpperCase();
                    if (headerName === targetTalla || headerName === ("TALLA_" + targetTalla) || headerName === ("STOCK_" + targetTalla)) {
                      const currentVal = Number(catalogData[c][colIdx]) || 0;
                      catalogSheet.getRange(c + 1, colIdx + 1).setValue(currentVal + addVal);
                    }
                  }
                }
              }
            }
          });
        }
        
        const supplierData = supplierSheet.getDataRange().getValues();
        
        for (let a = 0; a < assignments.length; a++) {
          const assign = assignments[a];
          const tallasRem = assign.tallas_remaining || {};
          const targetId = assign.id_producto;
          const assignNoFoto = Number(assign.no_foto) || 0;
          const assignFoto = String(assign.foto || "").trim();
          const assignRemark = String(assign.remark || "").trim();
          
          Object.keys(tallasRem).forEach(function(tallaKey) {
            const remVal = Number(tallasRem[tallaKey]);
            const targetTalla = String(tallaKey).trim().toUpperCase();
            
            for (let r = 1; r < supplierData.length; r++) {
              const rowFolio = String(supplierData[r][0]).trim();
              const rowNoFoto = Number(supplierData[r][1]) || 0;
              const rowEquipo = String(supplierData[r][4]).trim();
              const rowFoto = String(supplierData[r][5]).trim();
              const rowRemark = String(supplierData[r][6]).trim();
              const rowTalla = String(supplierData[r][7]).trim().toUpperCase();
              
              const matchNoFoto = (assignNoFoto > 0 && rowNoFoto > 0)
                ? (rowNoFoto === assignNoFoto)
                : ((assignFoto && rowFoto === assignFoto) || (assignRemark && (rowRemark === assignRemark || rowEquipo === assignRemark)));
              
              if (rowFolio === folio && matchNoFoto && rowTalla === targetTalla) {
                supplierSheet.getRange(r + 1, 4).setValue(targetId);
                
                if (remVal <= 0) {
                  supplierSheet.getRange(r + 1, 13).setValue("Ingresado a Stock");
                } else {
                  supplierSheet.getRange(r + 1, 9).setValue(remVal);
                  supplierSheet.getRange(r + 1, 13).setValue("Parcial");
                }
              }
            }
          });
        }
        
        const updatedSupplierData = supplierSheet.getDataRange().getValues();
        let totalPendingInFolio = 0;
        
        for (let r = 1; r < updatedSupplierData.length; r++) {
          if (String(updatedSupplierData[r][0]).trim() === folio) {
            const rowStatus = String(updatedSupplierData[r][12]).trim();
            if (rowStatus !== "Ingresado a Stock") {
              totalPendingInFolio += (Number(updatedSupplierData[r][8]) || 0);
            }
          }
        }
        
        const finalStatus = (totalPendingInFolio <= 0) ? "Ingresado a Stock" : "Parcial";
        
        if (finalStatus === "Ingresado a Stock") {
          for (let r = 1; r < updatedSupplierData.length; r++) {
            if (String(updatedSupplierData[r][0]).trim() === folio) {
              supplierSheet.getRange(r + 1, 13).setValue("Ingresado a Stock");
            }
          }
        }
        
        return construirRespuesta({ 
          "status": "success", 
          "message": "Stock actualizado exitosamente",
          "final_status": finalStatus,
          "total_pending_remaining": totalPendingInFolio
        });
      }

      // ==========================================
      // ACCIÓN: REINICIAR CICLO SÚPER MAYOREO (AL CLIC EN ¡EXCELENTE!)
      // ==========================================
      case "renew_super_mayoreo_cycle": {
        const idCliente = data.id_cliente;
        const hojaClientes = ss.getSheetByName("Clientes");
        if (!hojaClientes || !idCliente) return construirRespuesta({ "status": "error", "message": "Datos incompletos" });

        const datosCli = hojaClientes.getDataRange().getValues();
        const cabecerasCli = datosCli[0] || [];
        let colIdxPerfil = 6;
        let colIdxExp = 16;
        let colIdxAcum = 17;
        let colIdxSuperActivo = 18;

        for (let c = 0; c < cabecerasCli.length; c++) {
          const h = String(cabecerasCli[c] || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_-]/g, "").trim();
          if (h.indexOf("perfil") !== -1) colIdxPerfil = c + 1;
          if (h.indexOf("exp") !== -1 || h.indexOf("vigencia") !== -1) colIdxExp = c + 1;
          if (h.indexOf("acum") !== -1) colIdxAcum = c + 1;
          if (h.indexOf("superactivo") !== -1 || (h.indexOf("super") !== -1 && h.indexOf("activo") !== -1)) colIdxSuperActivo = c + 1;
        }

        const targetId = String(idCliente || "").trim().toUpperCase();
        let rowCliTarget = -1;
        for (let r = 1; r < datosCli.length; r++) {
          if (datosCli[r] && String(datosCli[r][0] || "").trim().toUpperCase() === targetId) {
            rowCliTarget = r + 1;
            break;
          }
        }

        if (rowCliTarget !== -1) {
          const valExpRaw = hojaClientes.getRange(rowCliTarget, colIdxExp).getValue();
          let baseDate = new Date();
          if (valExpRaw) {
            const dExp = new Date(valExpRaw);
            if (!isNaN(dExp.getTime()) && dExp.getTime() > baseDate.getTime()) {
              baseDate = dExp;
            }
          }
          const fechaExpISO = new Date(baseDate.getTime() + (6 * 24 * 60 * 60 * 1000)).toISOString();
          hojaClientes.getRange(rowCliTarget, colIdxPerfil).setValue("Súper Mayoreo");
          hojaClientes.getRange(rowCliTarget, colIdxSuperActivo).setValue(1);
          hojaClientes.getRange(rowCliTarget, colIdxExp).setValue(fechaExpISO);
          hojaClientes.getRange(rowCliTarget, colIdxAcum).setValue(0);
          SpreadsheetApp.flush();

          return construirRespuesta({
            "status": "success",
            "message": "Ciclo renovado exitosamente. Acumulado en 0 y vigencia +6 días.",
            "super_mayoreo_exp": fechaExpISO,
            "super_mayoreo_acum": 0,
            "super_mayoreo_activo": 1
          });
        }
        return construirRespuesta({ "status": "error", "message": "Cliente no encontrado" });
      }

      default:
        return construirRespuesta({ "status": "error", "message": "Acción no válida." });
    }
  } catch (error) {
    return construirRespuesta({ "status": "error", "message": error.toString() });
  }
}

/**
 * 🔄 FUNCIÓN AUXILIAR DE BYPASS
 */
function ejecutarBypassBorradoDirecto(ss, data) {
  const hojaOrdenes = ss.getSheetByName("Ordenes");
  const hojaDetalle = ss.getSheetByName("Ordenes_Detalle");
  const hojaInventario = ss.getSheetByName("Inventario_Tallas");
  const hojaConfigs = ss.getSheetByName("Configuraciones");

  const idDetalleBuscado = data.id_detalle;
  let datosDetalle = hojaDetalle.getDataRange().getValues();
  const idxIdInv = datosDetalle[0].indexOf("IdInventario");
  if (idxIdInv === -1) return construirRespuesta({ "status": "error", "message": "Falta columna IdInventario en cabecera." });

  let filaDetalle = -1; let idOrdenAsociada = ""; let cantidadAAgregar = 0; let idInventarioAsociado = "";

  for (let d = 1; d < datosDetalle.length; d++) {
    if (String(datosDetalle[d][0]).trim() === String(idDetalleBuscado).trim()) {
      filaDetalle = d + 1; idOrdenAsociada = datosDetalle[d][1]; cantidadAAgregar = Number(datosDetalle[d][4]); 
      idInventarioAsociado = String(datosDetalle[d][idxIdInv]).toUpperCase().trim(); break;
    }
  }
  if (filaDetalle === -1) return construirRespuesta({ "status": "error", "message": "Artículo no localizado." });
  
  const datosInventario = hojaInventario.getDataRange().getValues();
  for (let j = 1; j < datosInventario.length; j++) {
    const idCeldaStock = String(datosInventario[j][0]).toUpperCase().trim();
    if (idCeldaStock === idInventarioAsociado && idCeldaStock !== "") {
      hojaInventario.getRange(j + 1, 5).setValue(Number(datosInventario[j][4]) + cantidadAAgregar); break;
    }
  }

  let idxEstatusDet = datosDetalle[0].indexOf("EstatusOrdenDetalle");
  if (idxEstatusDet === -1) {
    hojaDetalle.getRange(1, datosDetalle[0].length + 1).setValue("EstatusOrdenDetalle");
    idxEstatusDet = datosDetalle[0].length;
    datosDetalle = hojaDetalle.getDataRange().getValues();
  }

  hojaDetalle.getRange(filaDetalle, idxEstatusDet + 1).setValue(0);
  
  datosDetalle = hojaDetalle.getDataRange().getValues();
  let piezasRestantesTotal = 0; let dineroRestantePrendas = 0;
  for (let d = 1; d < datosDetalle.length; d++) {
    if (String(datosDetalle[d][1]).trim() === String(idOrdenAsociada).trim()) {
      let estatusDetalle = 1;
      if (idxEstatusDet !== -1 && datosDetalle[d][idxEstatusDet] !== "") {
        estatusDetalle = Number(datosDetalle[d][idxEstatusDet]);
      }
      if (estatusDetalle !== 0) {
        piezasRestantesTotal += Number(datosDetalle[d][4]); 
        dineroRestantePrendas += Number(datosDetalle[d][8]); 
      }
    }
  }

  const datosOrdenes = hojaOrdenes.getDataRange().getValues();
  let filaOrden = -1; for (let o = 1; o < datosOrdenes.length; o++) { if (String(datosOrdenes[o][0]).trim() === String(idOrdenAsociada).trim()) { filaOrden = o + 1; break; } }

  if (filaOrden !== -1) {
    if (piezasRestantesTotal === 0) { 
      hojaOrdenes.getRange(filaOrden, 6).setValue("Cancelada"); 
      hojaOrdenes.getRange(filaOrden, 4).setValue(0);
      hojaOrdenes.getRange(filaOrden, 8).setValue(0);
      hojaOrdenes.getRange(filaOrden, 9).setValue(0);
      return construirRespuesta({ "status": "success", "message": "Pedido cancelado automáticamente al no quedar artículos activos.", "orden_vaciada": true }); 
    }
    
    let nuevoEnvio = 0; 
    if (datosOrdenes[filaOrden - 1][6] === "Sí") {
      nuevoEnvio = 70; const dtC = hojaConfigs.getDataRange().getValues();
      for (let i = 1; i < dtC.length; i++) { 
        if (dtC[i][7]) { 
          const partes = String(dtC[i][7]).split(":"); const rango = partes[0].split("-"); if (piezasRestantesTotal >= Number(rango[0]) && piezasRestantesTotal <= Number(rango[1])) { nuevoEnvio = Number(partes[1]); break; } 
        } 
      }
    }
    hojaOrdenes.getRange(filaOrden, 4).setValue(dineroRestantePrendas);
    hojaOrdenes.getRange(filaOrden, 8).setValue(nuevoEnvio);
    hojaOrdenes.getRange(filaOrden, 9).setValue(dineroRestantePrendas + nuevoEnvio);
  }
  
  SpreadsheetApp.flush();
  return construirRespuesta({ "status": "success", "message": "Artículo removido e inventario restaurado.", "orden_vaciada": false });
}

function construirRespuesta(objetoJson) {
  return ContentService.createTextOutput(JSON.stringify(objetoJson)).setMimeType(ContentService.MimeType.JSON);
}

function triggerPermissions() {
  Logger.log("Iniciando solicitud de permisos de Drive...");
  try {
    const folders = DriveApp.getFoldersByName("Jersey Store Images");
    if (folders.hasNext()) {
      Logger.log("Carpeta encontrada: " + folders.next().getName());
    } else {
      Logger.log("Carpeta no existe aún.");
    }
  } catch (e) {
    Logger.log("Error: " + e.toString());
  }
}

// ==========================================
// TOKENS DE SESIÓN
// ==========================================

function generarToken() {
  const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  return token;
}

function registrarSesion(ss, id_cliente, usuario, perfil) {
  let hojaSesiones = ss.getSheetByName("Sesiones Active");
  if (!hojaSesiones) {
    hojaSesiones = ss.insertSheet("Sesiones Active");
    hojaSesiones.appendRow(["Token", "ID Cliente", "Usuario", "Perfil", "Fecha Creacion", "Fecha Expiracion"]);
  }
  
  const token = generarToken();
  const fechaCreacion = new Date();
  const expTimestamp = fechaCreacion.getTime() + (24 * 60 * 60 * 1000);
  const idBuscado = String(id_cliente).trim().toUpperCase();
  
  const datos = hojaSesiones.getDataRange().getValues();
  let filaExistente = -1;
  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][1]).trim().toUpperCase() === idBuscado) {
      filaExistente = i + 1;
      break;
    }
  }
  
  if (filaExistente !== -1) {
    hojaSesiones.getRange(filaExistente, 1, 1, 6).setValues([[token, id_cliente, usuario, perfil, fechaCreacion.getTime(), expTimestamp]]);
  } else {
    hojaSesiones.appendRow([token, id_cliente, usuario, perfil, fechaCreacion.getTime(), expTimestamp]);
  }
  
  return token;
}

function validarToken(ss, token, rolRequerido) {
  if (!token) return { "status": "invalid", "message": "Falta el token de sesión en la petición o tu sesión ha expirado." };
  
  const tokenBuscado = String(token).trim();
  const cacheKey = "token_auth_" + tokenBuscado;
  
  try {
    const cache = CacheService.getScriptCache();
    const cachedDataStr = cache.get(cacheKey);
    if (cachedDataStr) {
      const cachedAuth = JSON.parse(cachedDataStr);
      if (cachedAuth && cachedAuth.status === "valid") {
        if (rolRequerido && cachedAuth.perfil !== rolRequerido) {
          return { "status": "invalid", "message": "Acceso denegado. Se requieren permisos de administrador." };
        }
        return cachedAuth;
      }
    }
  } catch (eCache) {}

  let hojaSesiones = ss.getSheetByName("Sesiones Active");
  if (!hojaSesiones) {
    hojaSesiones = ss.insertSheet("Sesiones Active");
    hojaSesiones.appendRow(["Token", "ID Cliente", "Usuario", "Perfil", "Fecha Creacion", "Fecha Expiracion"]);
    return { "status": "invalid", "message": "Tu sesión ha expirado o no es válida. Por favor, inicia sesión de nuevo." };
  }
  
  const datos = hojaSesiones.getDataRange().getValues();
  
  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][0]).trim() === tokenBuscado) {
      const valExp = datos[i][5];
      const ahora = new Date();
      let hasExpired = false;
      
      try {
        const expTimestamp = Number(valExp);
        if (isNaN(expTimestamp) || expTimestamp <= 0 || ahora.getTime() > expTimestamp) {
          hasExpired = true;
        }
      } catch (e) {
        hasExpired = true;
      }
      
      if (hasExpired) {
        return { "status": "invalid", "message": "Tu sesión ha expirado o no es válida. Por favor inicia sesión de nuevo." };
      }
      
      const perfil = datos[i][3];
      const usuario = datos[i][2];
      const id_cliente = datos[i][1];
      
      const authResult = { "status": "valid", "id_cliente": id_cliente, "usuario": usuario, "perfil": perfil };
      
      try {
        CacheService.getScriptCache().put(cacheKey, JSON.stringify(authResult), 600);
      } catch (ePut) {}

      return authResult;
    }
  }
  
  return { "status": "invalid", "message": "Sesión inválida, no iniciada o inexistente." };
}

function obtenerReglasMayoreoSuper(ss) {
  try {
    const hojaConfigs = ss.getSheetByName("Configuraciones");
    if (!hojaConfigs) return { piezas_jugador: 12, piezas_mayoreo_super: 12, activo: 1 };
    
    const datos = hojaConfigs.getDataRange().getValues();
    if (!datos || datos.length === 0) return { piezas_jugador: 12, piezas_mayoreo_super: 12, activo: 1 };

    let piezasJugadorSuperVal = null;
    let piezasMayoreoSuperVal = null;

    for (let r = 0; r < datos.length; r++) {
      if (datos[r] && datos[r].length >= 2) {
        const keyStr = String(datos[r][0] || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_-]/g, "");
        if (keyStr.indexOf("piezasjugadormayoreosuper") !== -1 || keyStr.indexOf("piezasjugador") !== -1 || keyStr.indexOf("jugadormayoreo") !== -1) {
          const valCell = Number(datos[r][1]);
          if (!isNaN(valCell) && valCell > 0) piezasJugadorSuperVal = valCell;
        }
        if (keyStr.indexOf("piezasmayoreosuper") !== -1 || keyStr.indexOf("piezassuper") !== -1 || keyStr === "piezasmayoreosuper") {
          const valCell = Number(datos[r][1]);
          if (!isNaN(valCell) && valCell > 0) piezasMayoreoSuperVal = valCell;
        }
      }
    }

    if (piezasJugadorSuperVal === null && datos.length > 1) {
      const cabeceras = datos[0];
      for (let c = 0; c < cabeceras.length; c++) {
        const header = String(cabeceras[c] || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_-]/g, "");
        if (header.indexOf("piezasjugador") !== -1 || header.indexOf("jugadormayoreo") !== -1) {
          const valCell = Number(datos[1][c]);
          if (!isNaN(valCell) && valCell > 0) piezasJugadorSuperVal = valCell;
        }
        if (header.indexOf("piezasmayoreosuper") !== -1) {
          const valCell = Number(datos[1][c]);
          if (!isNaN(valCell) && valCell > 0) piezasMayoreoSuperVal = valCell;
        }
      }
    }

    const valJugador = piezasJugadorSuperVal !== null ? piezasJugadorSuperVal : 12;
    const valRenovacion = piezasMayoreoSuperVal !== null ? piezasMayoreoSuperVal : valJugador;
    const activoVal = obtenerEstatusSuperMayoreo(ss);
    return { piezas_jugador: valJugador, piezas_mayoreo_super: valRenovacion, activo: activoVal };
  } catch (e) {
    return { piezas_jugador: 12, piezas_mayoreo_super: 12, activo: 1 };
  }
}

function obtenerEstatusSuperMayoreo(ss) {
  try {
    const hojaConfigs = ss.getSheetByName("Configuraciones");
    if (!hojaConfigs) return 1;
    
    const datos = hojaConfigs.getDataRange().getValues();
    if (!datos || datos.length <= 1) return 1;
    const cabeceras = datos[0];
    
    let idxActivarSuper = -1;
    for (let c = 0; c < cabeceras.length; c++) {
      const h = String(cabeceras[c] || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_-]/g, "");
      if (h.indexOf("supermayoreo") !== -1 && (h.indexOf("activ") !== -1 || h.indexOf("habilitar") !== -1 || h.indexOf("estatus") !== -1 || h.indexOf("estado") !== -1)) {
        idxActivarSuper = c;
        break;
      }
    }
    
    if (idxActivarSuper === -1) return 1;
    
    const val = datos[1][idxActivarSuper];
    return (val !== "" && val !== undefined && val !== null) ? Number(val) : 1;
  } catch (e) {
    return 1;
  }
}

function verificarYActualizarExpiracionSuperMayoreo(ss, id_cliente, datosPrecargados, filaPrecargada) {
  try {
    const ahora = new Date();
    const hojaClientes = ss.getSheetByName("Clientes");
    if (!hojaClientes) return { perfil: "Mayoreo", exp: "", acum: 0, super_mayoreo_activo: 0 };
    
    const superMayoreoGlobalActivo = obtenerEstatusSuperMayoreo(ss);
    
    const datos = (datosPrecargados && datosPrecargados.length > 0) ? datosPrecargados : hojaClientes.getDataRange().getValues();
    if (!datos || datos.length <= 1) return { perfil: "Mayoreo", exp: "", acum: 0, super_mayoreo_activo: 0 };
    
    const cabeceras = datos[0] || [];
    
    let idxPerfil = 5;
    let idxExp = 15;
    let idxAcum = 16;
    let idxSuperActivo = 17;
    let idxVip = 18;
    
    for (let c = 0; c < cabeceras.length; c++) {
      const h = String(cabeceras[c] || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_-]/g, "").trim();
      if (h === "perfil" || h === "tipo_perfil" || h === "tipoperfil") idxPerfil = c;
      if (h === "supermayoreoexp" || h === "supermayoreo_exp") idxExp = c;
      if (h === "supermayoreoacum" || h === "supermayoreo_acum") idxAcum = c;
      if (h === "supermayoreoactivo" || h === "supermayoreo_activo" || h === "supermayor" || h === "supermayoreo") idxSuperActivo = c;
      if (h === "vip" || h === "clientevip" || h === "esvip" || h === "es_vip" || h === "is_vip") idxVip = c;
    }

    const idBuscado = String(id_cliente || "").trim().toUpperCase();
    const startIdx = (filaPrecargada !== undefined && filaPrecargada > 0) ? filaPrecargada : 1;
    const endIdx = (filaPrecargada !== undefined && filaPrecargada > 0) ? filaPrecargada + 1 : datos.length;

    for (let i = startIdx; i < endIdx && i < datos.length; i++) {
      if (datos[i] && String(datos[i][0] || "").trim().toUpperCase() === idBuscado) {
        let perfil = String((idxPerfil < datos[i].length && datos[i][idxPerfil] !== "" && datos[i][idxPerfil] !== undefined) ? datos[i][idxPerfil] : hojaClientes.getRange(i + 1, idxPerfil + 1).getValue()).trim();
        if (!perfil) perfil = "Mayoreo";

        if (perfil.toLowerCase() === "administrador") {
          return { 
            perfil: "Administrador", 
            exp: "", 
            acum: 0, 
            vip: 0, 
            super_mayoreo_activo: 0, 
            fila: i + 1 
          };
        }

        let exp = (idxExp < datos[i].length && datos[i][idxExp] !== "" && datos[i][idxExp] !== undefined) ? datos[i][idxExp] : hojaClientes.getRange(i + 1, idxExp + 1).getValue();
        let acum = (idxAcum < datos[i].length && datos[i][idxAcum] !== "" && datos[i][idxAcum] !== undefined) ? Number(datos[i][idxAcum]) : Number(hojaClientes.getRange(i + 1, idxAcum + 1).getValue() || 0);
        
        let valSuperActivoRaw = hojaClientes.getRange(i + 1, 18).getValue();
        let valVipRaw = hojaClientes.getRange(i + 1, 19).getValue();
        
        const valVipStr = String(valVipRaw !== undefined && valVipRaw !== null ? valVipRaw : "").toLowerCase().trim();
        const valSuperActivoStr = String(valSuperActivoRaw !== undefined && valSuperActivoRaw !== null ? valSuperActivoRaw : "").toLowerCase().trim();
        
        const isVip = (
          valVipRaw === true ||
          valVipStr === "1" || valVipStr === "1.0" || valVipStr === "si" || valVipStr === "sí" || valVipStr === "true" || valVipStr === "vip" || valVipStr === "v" || valVipStr === "x" || Number(valVipRaw) === 1 ||
          valSuperActivoRaw === true || valSuperActivoStr === "1" || valSuperActivoStr === "1.0" || valSuperActivoStr === "true" || Number(valSuperActivoRaw) === 1 ||
          String(perfil).toLowerCase().includes("super")
        );

        if (superMayoreoGlobalActivo === 0) {
          try {
            perfil = "Mayoreo";
            if (idxPerfil >= 0) hojaClientes.getRange(i + 1, idxPerfil + 1).setValue("Mayoreo");
            if (idxExp >= 0) hojaClientes.getRange(i + 1, idxExp + 1).setValue("");
            if (idxAcum >= 0) hojaClientes.getRange(i + 1, idxAcum + 1).setValue("");
            if (idxSuperActivo >= 0) hojaClientes.getRange(i + 1, idxSuperActivo + 1).setValue(0);
          } catch (eWrite) {
            console.warn("No se pudo escribir reseteo de supermayoreo:", eWrite);
          }

          return { 
            perfil: "Mayoreo", 
            exp: "", 
            acum: "", 
            vip: isVip ? 1 : 0,
            super_mayoreo_activo: 0, 
            fila: i + 1, 
            idxPerfil: idxPerfil, 
            idxExp: idxExp, 
            idxAcum: idxAcum, 
            idxSuperActivo: idxSuperActivo 
          };
        }

        if (!isVip) {
          perfil = "Mayoreo";
          if (idxPerfil >= 0 && String(datos[i][idxPerfil]).trim() !== "Mayoreo") {
            try { hojaClientes.getRange(i + 1, idxPerfil + 1).setValue("Mayoreo"); } catch(eV0){}
          }
          if (idxExp >= 0 && exp !== "" && exp !== null) {
            try { hojaClientes.getRange(i + 1, idxExp + 1).setValue(""); } catch(eE0){}
          }
          if (idxAcum >= 0 && Number(acum) !== 0) {
            try { hojaClientes.getRange(i + 1, idxAcum + 1).setValue(0); } catch(eA0){}
          }
          if (idxSuperActivo >= 0 && Number(valSuperActivoRaw) !== 0) {
            try { hojaClientes.getRange(i + 1, idxSuperActivo + 1).setValue(0); } catch(eSA0){}
          }
          return { 
            perfil: "Mayoreo", 
            exp: "", 
            acum: 0, 
            vip: 0, 
            super_mayoreo_activo: 0, 
            fila: i + 1, 
            idxPerfil: idxPerfil, 
            idxExp: idxExp, 
            idxAcum: idxAcum, 
            idxSuperActivo: idxSuperActivo 
          };
        }

        const reglasSuper = obtenerReglasMayoreoSuper(ss);
        const metaPiezasJugador = Number(reglasSuper.piezas_jugador || 12);

        let tienePerfilSuperActivo = (Number(valSuperActivoRaw) === 1 || String(perfil).toLowerCase().includes("super"));
        let esRenovado = false;
        let esBeneficioPerdido = false;

        if (exp) {
          let hasExpired = false;
          try {
            const fechaExp = new Date(exp);
            if (isNaN(fechaExp.getTime()) || ahora.getTime() > fechaExp.getTime()) {
              hasExpired = true;
            }
          } catch (e) { hasExpired = true; }

          if (hasExpired) {
            if (acum >= metaPiezasJugador) {
              const nuevaExpDate = new Date(ahora.getTime() + (6 * 24 * 60 * 60 * 1000)).toISOString();
              exp = nuevaExpDate;
              if (idxExp >= 0) try { hojaClientes.getRange(i + 1, idxExp + 1).setValue(exp); } catch(eExpR){}
              if (idxPerfil >= 0) try { hojaClientes.getRange(i + 1, idxPerfil + 1).setValue("Súper Mayoreo"); } catch(ePerfR){}
              if (idxSuperActivo >= 0) try { hojaClientes.getRange(i + 1, idxSuperActivo + 1).setValue(1); } catch(eActR){}
              tienePerfilSuperActivo = true;
              esRenovado = true;
            } else {
              if (idxPerfil >= 0) try { hojaClientes.getRange(i + 1, idxPerfil + 1).setValue("Mayoreo"); } catch(eP1){}
              if (idxExp >= 0) try { hojaClientes.getRange(i + 1, idxExp + 1).setValue(""); } catch(eP2){}
              if (idxAcum >= 0) try { hojaClientes.getRange(i + 1, idxAcum + 1).setValue(0); } catch(eP3){}
              if (idxSuperActivo >= 0) try { hojaClientes.getRange(i + 1, idxSuperActivo + 1).setValue(0); } catch(eP4){}
              perfil = "Mayoreo";
              exp = "";
              acum = 0;
              tienePerfilSuperActivo = false;
              esBeneficioPerdido = true;
            }
          } else {
            tienePerfilSuperActivo = true;
          }
        } else if (tienePerfilSuperActivo) {
          exp = new Date(ahora.getTime() + (6 * 24 * 60 * 60 * 1000)).toISOString();
          if (idxExp >= 0) try { hojaClientes.getRange(i + 1, idxExp + 1).setValue(exp); } catch(eExpSet){}
        }

        if (tienePerfilSuperActivo) {
          perfil = "Súper Mayoreo";
          if (idxPerfil >= 0 && String(datos[i][idxPerfil]).trim() !== "Súper Mayoreo") {
            try { hojaClientes.getRange(i + 1, idxPerfil + 1).setValue("Súper Mayoreo"); } catch(eV1){}
          }
        } else {
          perfil = "Mayoreo";
          if (idxPerfil >= 0 && String(datos[i][idxPerfil]).trim() !== "Mayoreo") {
            try { hojaClientes.getRange(i + 1, idxPerfil + 1).setValue("Mayoreo"); } catch(eV2){}
          }
        }
        
        return { 
          perfil: perfil, 
          exp: exp, 
          acum: acum, 
          vip: 1, 
          super_mayoreo_activo: tienePerfilSuperActivo ? 1 : 0,
          meta_piezas: metaPiezasJugador,
          es_renovado: esRenovado,
          es_beneficio_perdido: esBeneficioPerdido,
          fila: i + 1, 
          idxPerfil: idxPerfil, 
          idxExp: idxExp, 
          idxAcum: idxAcum, 
          idxSuperActivo: idxSuperActivo 
        };
      }
    }
    return { perfil: "Mayoreo", exp: "", acum: 0, vip: 0, super_mayoreo_activo: 0 };
  } catch (err) {
    Logger.log("Error al verificar expiración Súper Mayoreo: " + err);
    return { perfil: "Mayoreo", exp: "", acum: 0, super_mayoreo_activo: 0 };
  }
}

// ==========================================
// 🌟 FUNCIÓN AUXILIAR: PROCESAR SÚPER MAYOREO AL CAMBIAR ESTATUS
// ==========================================
function procesarSuperMayoreoAlCambiarEstatus(ss, id_orden, nuevo_estatus) {
  try {
    const normNewStatus = String(nuevo_estatus || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    
    // Estatus autorizados que activan o acumulan Súper Mayoreo:
    const esAutorizado = (
      normNewStatus.includes("disponible") ||
      normNewStatus.includes("recoger") ||
      normNewStatus.includes("enviar") ||
      normNewStatus.includes("enviado") ||
      normNewStatus.includes("paqueteria") ||
      normNewStatus.includes("finalizad") ||
      normNewStatus.includes("completad") ||
      normNewStatus.includes("entregad")
    );
    
    if (!esAutorizado) return null;

    const hojaOrdenes = ss.getSheetByName("Ordenes");
    const hojaDetalle = ss.getSheetByName("Ordenes_Detalle");
    const hojaPlayeras = ss.getSheetByName("Playeras");
    const hojaInventario = ss.getSheetByName("Inventario_Tallas");
    if (!hojaOrdenes || !hojaDetalle) return null;

    const datosOrdenes = hojaOrdenes.getDataRange().getValues();
    if (!datosOrdenes || datosOrdenes.length <= 1) return null;

    const cabecerasOrd = datosOrdenes[0] || [];
    let idCliente = "";
    let filaOrdenTarget = -1;
    let idxCantOrd = -1;
    let idxProcesadoOrd = -1;

    for (let c = 0; c < cabecerasOrd.length; c++) {
      const hOrd = String(cabecerasOrd[c] || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_-]/g, "");
      if (hOrd.indexOf("piezas") !== -1 || hOrd.indexOf("totalpiezas") !== -1 || hOrd === "cant" || hOrd === "cantidad") {
        idxCantOrd = c;
      }
      if (hOrd.indexOf("supermayoreoprocesado") !== -1 || hOrd.indexOf("procesadosuper") !== -1 || hOrd.indexOf("superprocesado") !== -1) {
        idxProcesadoOrd = c;
      }
    }

    if (idxProcesadoOrd === -1) {
      idxProcesadoOrd = cabecerasOrd.length;
      try { hojaOrdenes.getRange(1, idxProcesadoOrd + 1).setValue("SuperMayoreoProcesado"); } catch (eHOrd) {}
    }

    for (let i = 1; i < datosOrdenes.length; i++) {
      if (datosOrdenes[i] && String(datosOrdenes[i][0] || "").trim().toUpperCase() === String(id_orden || "").trim().toUpperCase()) {
        idCliente = String(datosOrdenes[i][1] || "").trim();
        filaOrdenTarget = i + 1;
        break;
      }
    }

    if (!idCliente || filaOrdenTarget <= 0) return null;

    const estatusNorm = String(nuevo_estatus || "").toLowerCase().trim();
    const esEstatusAutorizado = (
      estatusNorm.indexOf("disponible") !== -1 ||
      estatusNorm.indexOf("enviado") !== -1 ||
      estatusNorm.indexOf("recoger") !== -1 ||
      estatusNorm.indexOf("paqueteria") !== -1
    );
    const esEstatusCancelado = (estatusNorm.indexOf("cancelad") !== -1);

    const valProcesadoRaw = datosOrdenes[filaOrdenTarget - 1][idxProcesadoOrd];
    const yaProcesado = (Number(valProcesadoRaw) === 1 || String(valProcesadoRaw).toLowerCase() === "sí" || String(valProcesadoRaw).toLowerCase() === "si" || String(valProcesadoRaw).toLowerCase() === "true");

    // 1. Mapear Playeras para saber la versión/tipo de cada producto por su ID
    const mapaPlayeras = {};
    if (hojaPlayeras) {
      const dP = hojaPlayeras.getDataRange().getValues();
      for (let p = 1; p < dP.length; p++) {
        const idP = String(dP[p][0] || "").trim().toUpperCase();
        mapaPlayeras[idP] = {
          version: String(dP[p][3] || "").toLowerCase(),
          nombre: String(dP[p][1] || "").toLowerCase(),
          full: String(dP[p].join(" ")).toLowerCase()
        };
      }
    }

    // 2. Mapear IdInventario a IdPlayera
    const mapaInventarioAPlayera = {};
    if (hojaInventario) {
      const dI = hojaInventario.getDataRange().getValues();
      for (let j = 1; j < dI.length; j++) {
        const idInv = String(dI[j][0] || "").trim().toUpperCase();
        const idPlayera = String(dI[j][1] || "").trim().toUpperCase();
        mapaInventarioAPlayera[idInv] = idPlayera;
      }
    }

    // 3. Contar prendas en Ordenes_Detalle
    const datosDetalle = hojaDetalle.getDataRange().getValues();
    if (!datosDetalle || datosDetalle.length <= 1) return null;

    const cabecerasDet = datosDetalle[0] || [];
    const idxEstDet = cabecerasDet.indexOf("EstatusOrdenDetalle");
    
    let idxCantDet = 4;
    for (let h = 0; h < cabecerasDet.length; h++) {
      const headerName = String(cabecerasDet[h] || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_-]/g, "");
      if (headerName === "cantidad" || headerName === "cant" || headerName === "piezas" || headerName === "quantity" || headerName === "qty") {
        idxCantDet = h;
        break;
      }
    }

    let piezasJugadorPedido = 0;
    let totalPiezasEnOrden = 0;

    for (let d = 1; d < datosDetalle.length; d++) {
      if (datosDetalle[d] && String(datosDetalle[d][1] || "").trim().toUpperCase() === String(id_orden || "").trim().toUpperCase()) {
        if (idxEstDet !== -1 && String(datosDetalle[d][idxEstDet] || "").trim() === "0") continue;

        const rawCant = datosDetalle[d][idxCantDet];
        const cant = Math.max(1, Number(String(rawCant !== undefined && rawCant !== null ? rawCant : "1").replace(/[^0-9.]/g, "")) || 1);
        totalPiezasEnOrden += cant;

        let valPlayera = String(datosDetalle[d][2] || "").trim().toUpperCase();
        if (valPlayera.startsWith("INV-") && mapaInventarioAPlayera[valPlayera]) {
          valPlayera = mapaInventarioAPlayera[valPlayera];
        }

        const infoProd = mapaPlayeras[valPlayera] || { version: "", nombre: "", full: "" };
        const versionStr = String(infoProd.version || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const fullStr = String(infoProd.full || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const detailRowStr = String(datosDetalle[d].join(" ")).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        const esAficionado = (
          versionStr.indexOf("aficionado") !== -1 ||
          versionStr.indexOf("fan") !== -1 ||
          versionStr.indexOf("replica") !== -1 ||
          fullStr.indexOf("aficionado") !== -1 ||
          detailRowStr.indexOf("aficionado") !== -1
        );

        const esJugador = !esAficionado && (
          versionStr.indexOf("jugador") !== -1 ||
          fullStr.indexOf("jugador") !== -1 ||
          detailRowStr.indexOf("jugador") !== -1 ||
          versionStr.indexOf("player") !== -1 ||
          versionStr.indexOf("pro") !== -1 ||
          versionStr.indexOf("match") !== -1 ||
          versionStr.indexOf("autentica") !== -1
        );

        if (esJugador) {
          piezasJugadorPedido += cant;
        }
      }
    }

    const superMayoreoGlobalActivo = obtenerEstatusSuperMayoreo(ss);
    if (superMayoreoGlobalActivo !== 1) return null;

    const hojaClientes = ss.getSheetByName("Clientes");
    if (!hojaClientes) return null;

    const datosCli = hojaClientes.getDataRange().getValues();
    if (!datosCli || datosCli.length <= 1) return null;

    const cabecerasCli = datosCli[0] || [];
    let colIdxPerfil = 6;       // Col F
    let colIdxExp = 16;         // Col P
    let colIdxAcum = 17;        // Col Q
    let colIdxSuperActivo = 18; // Col R
    let colIdxVip = 19;         // Col S

    for (let c = 0; c < cabecerasCli.length; c++) {
      const h = String(cabecerasCli[c] || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_-]/g, "").trim();
      if (h.indexOf("perfil") !== -1) colIdxPerfil = c + 1;
      if (h.indexOf("exp") !== -1 || h.indexOf("vigencia") !== -1) colIdxExp = c + 1;
      if (h.indexOf("acum") !== -1) colIdxAcum = c + 1;
      if (h.indexOf("superactivo") !== -1 || (h.indexOf("super") !== -1 && h.indexOf("activo") !== -1)) colIdxSuperActivo = c + 1;
      if (h === "vip" || h.indexOf("vip") !== -1) colIdxVip = c + 1;
    }

    const targetId = String(idCliente || "").trim().toUpperCase();
    let rowCliTarget = -1;

    for (let r = 1; r < datosCli.length; r++) {
      if (!datosCli[r]) continue;
      const colId = String(datosCli[r][0] || "").trim().toUpperCase();
      const colNom = String(datosCli[r][1] || "").trim().toUpperCase();
      const colTel = String(datosCli[r][2] || "").trim().toUpperCase();
      const colUser = String(datosCli[r][3] || "").trim().toUpperCase();
      
      if (colId === targetId || colUser === targetId || colTel === targetId || colNom === targetId || (targetId !== "" && (colId.includes(targetId) || targetId.includes(colId)))) {
        rowCliTarget = r + 1;
        break;
      }
    }

    if (rowCliTarget === -1) return null;

    // Validar si el cliente es VIP
    const valVipRaw = hojaClientes.getRange(rowCliTarget, colIdxVip).getValue();
    const valVipStr = String(valVipRaw !== undefined && valVipRaw !== null ? valVipRaw : "").toLowerCase().trim();
    const isVip = (valVipRaw === true || valVipStr === "1" || valVipStr === "1.0" || valVipStr === "si" || valVipStr === "sí" || valVipStr === "true" || valVipStr === "vip" || valVipStr === "v" || valVipStr === "x");

    if (!isVip) {
      // Cliente no VIP -> Forzar perfil Mayoreo sin modificar acumulados
      hojaClientes.getRange(rowCliTarget, colIdxPerfil).setValue("Mayoreo");
      hojaClientes.getRange(rowCliTarget, colIdxSuperActivo).setValue(0);
      hojaClientes.getRange(rowCliTarget, colIdxExp).setValue("");
      hojaClientes.getRange(rowCliTarget, colIdxAcum).setValue("");
      SpreadsheetApp.flush();
      return null;
    }

    const valAcumRaw = hojaClientes.getRange(rowCliTarget, colIdxAcum).getValue();
    const valAcum = Number(valAcumRaw || 0);

    const reglasSuper = obtenerReglasMayoreoSuper(ss);
    const metaPiezas = Number(reglasSuper.piezas_jugador || 12);

    const valExpRaw = hojaClientes.getRange(rowCliTarget, colIdxExp).getValue();
    let baseDate = new Date();
    if (valExpRaw) {
      const dExp = new Date(valExpRaw);
      if (!isNaN(dExp.getTime()) && dExp.getTime() > baseDate.getTime()) {
        baseDate = dExp; // Opción B: Sumar +6 días a la fecha de expiración previa si aún no vence
      }
    }
    const fechaExpISO = new Date(baseDate.getTime() + (6 * 24 * 60 * 60 * 1000)).toISOString();

    // 🔴 MANEJO DE CANCELACIONES
    if (esEstatusCancelado && yaProcesado) {
      hojaOrdenes.getRange(filaOrdenTarget, idxProcesadoOrd + 1).setValue(0);
      
      const acumRestado = Math.max(0, valAcum - piezasJugadorPedido);
      hojaClientes.getRange(rowCliTarget, colIdxAcum).setValue(acumRestado === 0 ? "" : acumRestado);

      // Si la cancelación provoca perder la meta o la orden fue la que activó Súper Mayoreo
      if (piezasJugadorPedido >= metaPiezas || valAcum < metaPiezas) {
        hojaClientes.getRange(rowCliTarget, colIdxPerfil).setValue("Mayoreo");
        hojaClientes.getRange(rowCliTarget, colIdxSuperActivo).setValue(0);
        hojaClientes.getRange(rowCliTarget, colIdxExp).setValue("");
        hojaClientes.getRange(rowCliTarget, colIdxAcum).setValue("");
      }
      SpreadsheetApp.flush();
      return null;
    }

    // 🟢 PROCESAMIENTO DE ESTATUS AUTORIZADO
    if (esEstatusAutorizado) {
      if (yaProcesado) {
        console.log("⚠️ Orden " + id_orden + " ya fue procesada previamente para Súper Mayoreo. Ignorando duplicación.");
        return null;
      }

      // Marcar orden como procesada
      hojaOrdenes.getRange(filaOrdenTarget, idxProcesadoOrd + 1).setValue(1);

      const valSuperActivoRaw = hojaClientes.getRange(rowCliTarget, colIdxSuperActivo).getValue();
      const isSuperActivoAct = (Number(valSuperActivoRaw) === 1 || String(valSuperActivoRaw).toLowerCase() === "true");

      const metaActivacion = Number(reglasSuper.piezas_jugador || 12);
      const metaRenovacion = Number(reglasSuper.piezas_mayoreo_super || reglasSuper.piezas_jugador || 12);

      if (isSuperActivoAct) {
        // 🟢 CLIENTE YA TIENE SÚPER MAYOREO ACTIVO (REGLA 4.2) -> ACUMULA CUALQUIER PRENDA / PLAYERA / JERSEY
        const totalPrendasOrden = totalPiezasEnOrden;
        const nuevoAcumCalculado = valAcum + totalPrendasOrden;

        if (nuevoAcumCalculado >= metaRenovacion || totalPrendasOrden >= metaRenovacion) {
          // 🎉 RENUEVA EL BENEFICIO (RESETEO A 0 Y EXTENSIÓN +6 DÍAS OPCIÓN B)
          hojaClientes.getRange(rowCliTarget, colIdxPerfil).setValue("Súper Mayoreo");
          hojaClientes.getRange(rowCliTarget, colIdxSuperActivo).setValue(1);
          hojaClientes.getRange(rowCliTarget, colIdxExp).setValue(fechaExpISO);
          hojaClientes.getRange(rowCliTarget, colIdxAcum).setValue(0);
        } else {
          // Acumulando cualquier prenda/playera dentro del ciclo activo
          hojaClientes.getRange(rowCliTarget, colIdxAcum).setValue(Number(nuevoAcumCalculado));
        }
      } else {
        // 🟡 CLIENTE EN MAYOREO (SIN SÚPER MAYOREO ACTIVO AÚN - REGLA 4.1) -> REQUIERE VERSIÓN JUGADOR
        if (piezasJugadorPedido >= metaActivacion) {
          // 🎉 PRIMERA ACTIVACIÓN EXITOSA (CUMPLE META JUGADOR EN UNA SOLA ORDEN)
          hojaClientes.getRange(rowCliTarget, colIdxPerfil).setValue("Súper Mayoreo");
          hojaClientes.getRange(rowCliTarget, colIdxSuperActivo).setValue(1);
          hojaClientes.getRange(rowCliTarget, colIdxExp).setValue(fechaExpISO);
          hojaClientes.getRange(rowCliTarget, colIdxAcum).setValue(0);
        } else {
          // ❌ NO CUMPLE META PARA PRIMERA ACTIVACIÓN -> NO PUEDE ACUMULAR (QUEDA EN MAYOREO)
          hojaClientes.getRange(rowCliTarget, colIdxPerfil).setValue("Mayoreo");
          hojaClientes.getRange(rowCliTarget, colIdxSuperActivo).setValue(0);
          hojaClientes.getRange(rowCliTarget, colIdxExp).setValue("");
          hojaClientes.getRange(rowCliTarget, colIdxAcum).setValue("");
          console.log("ℹ️ Orden de " + piezasJugadorPedido + " piezas versión Jugador no alcanza la meta de " + metaActivacion + " para primera activación. No acumula.");
        }
      }

      SpreadsheetApp.flush();
      return {
        id_cliente: idCliente,
        perfil: piezasJugadorPedido >= metaPiezas || isSuperActivoAct ? "Súper Mayoreo" : "Mayoreo",
        super_mayoreo_exp: fechaExpISO,
        super_mayoreo_acum: 0,
        piezas_jugador: piezasJugadorPedido
      };
    }

    return null;
  } catch (err) {
    Logger.log("Error al procesar Súper Mayoreo al cambiar estatus: " + err);
    return null;
  }
}

// ==========================================
// FUNCIONES AUXILIARES PARA LOCAL 419
// ==========================================
function checkAndCreate419Tables(ss) {
  try {
    const sheetPlayerasOriginal = ss.getSheetByName("Playeras");
    const sheetTallasOriginal = ss.getSheetByName("Inventario_Tallas");

    let sheetPlayeras419 = ss.getSheetByName("Playeras419");
    if (!sheetPlayeras419) {
      sheetPlayeras419 = ss.insertSheet("Playeras419");
      if (sheetPlayerasOriginal && sheetPlayerasOriginal.getLastColumn() > 0) {
        const headers = sheetPlayerasOriginal.getRange(1, 1, 1, sheetPlayerasOriginal.getLastColumn()).getValues();
        sheetPlayeras419.getRange(1, 1, 1, headers[0].length).setValues(headers);
      }
    }

    let sheetTallas419 = ss.getSheetByName("Inventario_Tallas419");
    if (!sheetTallas419) {
      sheetTallas419 = ss.insertSheet("Inventario_Tallas419");
      if (sheetTallasOriginal && sheetTallasOriginal.getLastColumn() > 0) {
        const headersT = sheetTallasOriginal.getRange(1, 1, 1, sheetTallasOriginal.getLastColumn()).getValues();
        sheetTallas419.getRange(1, 1, 1, headersT[0].length).setValues(headersT);
      }
    }
  } catch (err) {
    Logger.log("Error al verificar/crear tablas 419: " + err.message);
  }
}

function traspasarOrdenALocal419Backend(ss, id_orden) {
  try {
    const sheetOrdenes = ss.getSheetByName("Ordenes");
    const sheetDetalle = ss.getSheetByName("Ordenes_Detalle");
    const sheetPlayeras419 = ss.getSheetByName("Playeras419");
    const sheetTallas419 = ss.getSheetByName("Inventario_Tallas419");
    const sheetTallasGen = ss.getSheetByName("Inventario_Tallas");

    if (!sheetOrdenes || !sheetDetalle || !sheetPlayeras419 || !sheetTallas419) {
      return { "status": "error", "message": "Componentes de la base de datos no inicializados." };
    }

    const datosDetalle = sheetDetalle.getDataRange().getValues();
    const mapaInventarioAPlayera = {};
    if (sheetTallasGen) {
      const dTG = sheetTallasGen.getDataRange().getValues();
      for (let j = 1; j < dTG.length; j++) {
        mapaInventarioAPlayera[String(dTG[j][0]).trim()] = String(dTG[j][1]).trim();
      }
    }

    const itemsTraspaso = [];
    const idxEstatusDet = datosDetalle[0].indexOf("EstatusOrdenDetalle");

    for (let d = 1; d < datosDetalle.length; d++) {
      if (String(datosDetalle[d][1]) === String(id_orden)) {
        if (idxEstatusDet !== -1 && String(datosDetalle[d][idxEstatusDet]).trim() === "0") continue;

        let valPlayera = String(datosDetalle[d][2]).trim();
        if (valPlayera.toUpperCase().startsWith("INV-")) {
          valPlayera = mapaInventarioAPlayera[valPlayera] || valPlayera;
        }

        itemsTraspaso.push({
          "id_playera": valPlayera,
          "talla": String(datosDetalle[d][3] || "").toUpperCase().trim(),
          "cantidad": Number(datosDetalle[d][4] || 1)
        });
      }
    }

    if (itemsTraspaso.length === 0) {
      return { "status": "error", "message": "No se encontraron artículos activos en la orden " + id_orden };
    }

    const data419T = sheetTallas419.getDataRange().getValues();
    itemsTraspaso.forEach(function(item) {
      const prodIdStr = String(item.id_playera).trim().toUpperCase();
      const tallaStr = String(item.talla).trim().toUpperCase();
      const cantSuma = Number(item.cantidad) || 0;
      let filaEncontrada = -1;

      for (let t = 1; t < data419T.length; t++) {
        const idP = String(data419T[t][1]).trim().toUpperCase();
        const sz = String(data419T[t][2]).trim().toUpperCase();
        if (idP === prodIdStr && sz === tallaStr) {
          filaEncontrada = t + 1;
          const currentQty = Number(data419T[t][4]) || 0;
          sheetTallas419.getRange(filaEncontrada, 5).setValue(currentQty + cantSuma);
          break;
        }
      }

      if (filaEncontrada === -1) {
        const idInv419 = "INV419-" + Math.floor(Math.random() * 900000 + 100000);
        sheetTallas419.appendRow([idInv419, item.id_playera, item.talla, "Adultos", cantSuma]);
      }
    });

    const dataOrd = sheetOrdenes.getDataRange().getValues();
    for (let o = 1; o < dataOrd.length; o++) {
      if (String(dataOrd[o][0]) === String(id_orden)) {
        sheetOrdenes.getRange(o + 1, 6).setValue("Traspasado a Local 419");
        break;
      }
    }

    return { "status": "success", "message": "Orden " + id_orden + " traspasada exitosamente a Local 419." };
  } catch (err) {
    return { "status": "error", "message": "Error al procesar el traspaso: " + err.message };
  }
}
