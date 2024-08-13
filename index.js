//Importar módulos
import express from "express";
import { create } from "express-handlebars";
import fileUpload from 'express-fileupload';
import { v4 as uuid } from 'uuid';
import db from "./database/config.js";
import jwt from "jsonwebtoken";
import verifyToken from "./utils/jwtVerify.js"
import adminVerify from "./utils/adminVerify.js"
import fs from "fs";

import * as path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

//Signature Secret
const secretSignature = "secreto";

const hbs = create({
    partialsDir: [
        path.resolve(__dirname, "./views/partials/"),
    ],
});

//Configuración de Handlebars como motor de vistas
app.engine("handlebars", hbs.engine);
app.set("view engine", "handlebars");
app.set("views", path.resolve(__dirname, "./views"));

//Iniciar servidor en puerto 3000
app.listen(3000, () => {
    console.log("Servidor escuchando en http://localhost:3000");
});

//CONFIG. MIDDLEWARES GENERALES
app.use(express.json());
app.use(express.static("public"));

//Configuración de fileUpload para manejo de archivos
let maxSizeImage = 2;
app.use(fileUpload({
    limits: { fileSize: maxSizeImage * 1024 * 1024 },
    abortOnLimit: true,
    limitHandler: (req, res) => { // set limit handler
        res.status(400).json({
            message: `Ha superado el tamaño establecido para las imágenes [${maxSizeImage} mbs.]`
        })
        limitHandlerRun = true;
    }
}));

//RUTAS DE VISTAS:

//1. VISTAS PÚBLICAS:

//Ruta para la página de inicio: "HOME"
app.get(["/", "/home", "/inicio"], async (req, res) => {
    try {
        //obtener todos los skaters de la base de datos
        let { rows } = await db.query("SELECT id, email, nombre, anos_experiencia, especialidad, foto, estado FROM skaters ORDER BY id");

        let skaters = rows;
        //renderizar la vista Home con los datos de los skaters
        res.render("Home", {
            skaters,
            homeView: true
        });
    } catch (error) {
        //manejar errores en caso de que la consulta falle
        res.render("Home", {
            error: "No se han podido cargar los datos en la vista.",
            homeView: true
        });
    }
});

//Ruta para la página de registro: "REGISTRO"
app.get("/registro", async (req, res) => {
    try {

        res.render("Registro", {
            registroView: true
        });
    } catch (error) {
        res.render("Registro", {
            error: "Ups! ha ocurrido un error.",
            registroView: true
        });
    }
});

//Ruta para la página de login: "LOGIN"
app.get("/login", (req, res) => {
    try {
        res.render("Login", {
            loginView: true
        });
    } catch (error) {
        res.render("Login", {
            error: "Ups! ha ocurrido un error.",
            loginView: true
        });
    }
});


//2. VISTAS PROTEGIDAS/PRIVADAS:

//Ruta para la página de perfil (requiere autenticación): "PERFIL"
app.get("/perfil", verifyToken, async (req, res) => {

    try {
        //obtener datos del usuario autenticado
        let consulta = {
            text: "SELECT nombre, email, anos_experiencia, especialidad FROM skaters WHERE id = $1",
            values: [req.usuario.id]
        }


        let { rows } = await db.query(consulta);

        let usuario = rows[0];

        if (!usuario) {
            return res.render("Datos", {
                error: "Usuario no encontrado",
                datosView: true
            });
        }

        res.render("Datos", {
            datosView: true,
            usuario
        });

    } catch (error) {
        res.render("Datos", {
            error: "Ups! ha ocurrido un error.",
            datosView: true
        });
    }
});

//Ruta para la página de administración (requiere autenticación y ser admin)
app.get("/admin", verifyToken, adminVerify, async (req, res) => {
    try {
        //Obtener todos los skaters para la vista de administración
        let { rows } = await db.query("SELECT id, email, nombre, anos_experiencia, especialidad, foto, estado FROM skaters ORDER BY id");

        let skaters = rows;

        res.render("Admin", {
            skaters
        });

    } catch (error) {
        res.render("Admin", {
            error: "Error al cargar datos"
        });
    }
})


//RUTAS PARA ENDPOINTS API:

//Endpoint para registro de usuarios
app.post("/api/v1/registro", async (req, res) => {
    try {
        //extraer datos del cuerpo de la solicitud y archivos
        let { email, nombre, password, anos_experiencia, especialidad } = req.body;
        let { imagen } = req.files;

        //verificar que todos los campos requeridos fueron ingresados
        if (!email || !nombre || !password || !anos_experiencia || !especialidad || !imagen) {
            res.status(400).json({
                message: "Debe proporcionar todos los datos requeridos."
            });
        };

        //generar un nombre único para la imagen
        let foto = `img-${uuid().slice(0, 4)}-${imagen.name}`;
        let uploadPath = __dirname + '/public/img/' + foto;

        //iniciar una transacción de db
        await db.query("BEGIN");

        //insertar el nuevo usuario en la base de datos
        let consulta = {
            text: "INSERT INTO skaters VALUES (DEFAULT, $1, $2, $3, $4, $5, $6, DEFAULT) RETURNING id",
            values: [email, nombre, password, anos_experiencia, especialidad, foto]
        }

        let { rows } = await db.query(consulta);

        let idUsuario = rows[0].id;

        //mover la imagen cargada al directorio
        imagen.mv(uploadPath, async function (err) {
            if (err) {
                await db.query("rollback");

                return res.status(500).json({
                    message: "Error al intentar guardar la imagen, vuelva a intentar"
                });
            }

            //confirmar la transacción si fue exitoso
            await db.query("commit");

            res.status(201).json({
                message: "Usuario registrado con éxito con ID: " + idUsuario
            })
        });

    } catch (error) {
        console.log(error);
        let message = "Error en proceso de registro, vuelva a intentar";
        let status = 500;

        if (error.code == '23505') {
            message = "Ya existe un usuario registrado con su email";
            status = 400;
        }

        await db.query("rollback");

        return res.status(status).json({
            message
        });
    }

});


//Endpoint para login de usuarios
app.post("/api/v1/login", async (req, res) => {
    try {
        let { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Debe proporcionar todos los datos." })
        }

        //verificar credenciales y obtener datos del usuario
        let consulta = {
            text: `SELECT S.id, S.nombre, S.email, A.estado AS admin FROM skaters S LEFT JOIN administradores A ON S.id = A.id_skater WHERE email = $1 AND password = $2`,
            values: [email, password]
        }

        let { rows, rowCount } = await db.query(consulta);

        if (rowCount == 0) {
            return res.status(400).json({ message: "Credenciales inválidas." })
        }

        let usuario = rows[0];

        //generar token
        let token = jwt.sign(usuario, secretSignature, { expiresIn: '15m' });

        res.json({
            message: "Login realizado con éxito",
            token,
            usuario
        });


    } catch (error) {
        res.status(500).json({
            message: "Error en proceso de login."
        })
    }
});

//Endpoint para actualizar datos del usuario
app.put("/api/v1/skaters", verifyToken, async (req, res) => {
    try {

        let { email, nombre, password, anos_experiencia, especialidad } = req.body;

        console.log(email, nombre, password, anos_experiencia, especialidad);

        //obtener datos actuales del usuario
        let { rows } = await db.query("SELECT id, email, nombre, password, anos_experiencia, especialidad FROM skaters WHERE id = $1", [req.usuario.id]);

        let usuario = rows[0];

        //actualizar datos del usuario
        usuario.email = email;
        usuario.nombre = nombre;
        if (password) {
            usuario.password = password;
        }
        usuario.anos_experiencia = anos_experiencia;
        usuario.especialidad = especialidad;

        //ejecutar la actualización en la base de datos
        await db.query("UPDATE skaters SET email = $1, nombre = $2, password = $3, anos_experiencia = $4, especialidad = $5 WHERE id = $6", [usuario.email, usuario.nombre, usuario.password, usuario.anos_experiencia, usuario.especialidad, usuario.id]);


        res.status(201).json({
            message: "Usuario actualizado con éxito."
        })

    } catch (error) {
        res.status(500).json({
            message: "Error al intentar actualizar los datos del usuario."
        })
    }
})


app.post("/api/v1/login", async (req, res) => {
    try {
        let { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Debe proporcionar todos los datos." })
        }

        let consulta = {
            text: "SELECT id, nombre, email FROM skaters WHERE email = $1 AND password = $2",
            values: [email, password]
        }

        let { rows, rowCount } = await db.query(consulta);

        if (rowCount == 0) {
            return res.status(400).json({ message: "Credenciales inválidas." })
        }

        let usuario = rows[0];

        let token = jwt.sign(usuario, secretSignature, { expiresIn: '15m' });

        res.json({
            message: "Login realizado con éxito",
            token,
            usuario
        });


    } catch (error) {
        res.status(500).json({
            message: "Error en proceso de login."
        })
    }
});


//Endpoint para eliminar la cuenta del usuario
app.delete("/api/v1/skaters", verifyToken, async (req, res) => {
    try {

        let { password } = req.body;
        console.log(password);

        if (!password) {
            return res.status(400).json({
                message: "Password no proporcionado para corroborar eliminación de cuenta."
            })
        }

        //iniciar transacción y eliminar usuario
        await db.query("BEGIN");

        let consulta = {
            text: "DELETE FROM skaters WHERE id = $1 AND password = $2 RETURNING foto",
            values: [req.usuario.id, password]
        }

        let { rowCount, rows } = await db.query(consulta);

        if (rowCount == 0) {
            await db.query("ROLLBACK");
            return res.status(400).json({
                message: "usuario no existe / contraseña no corroboración no válida."
            })
        }

        //eliminar la foto del usuario de la carpeta img
        let foto = rows[0].foto;
        fs.unlinkSync(path.resolve(__dirname, "./public/img", foto));


        await db.query("COMMIT");
        res.json({
            message: "Usuario eliminado correctamente."
        })

    } catch (error) {
        await db.query("ROLLBACK");
        res.status(500).json({
            message: "Error al intentar eliminar al usuario."
        })
    }
});


//Endpoint para cambiar el estado de un usuario (solo para admins)
app.put("/api/v1/skaters/estado", verifyToken, adminVerify, async (req, res) => {
    try {
        let { id } = req.query;
        if (!id) {
            return res.status(400).json({
                message: "Debe proporcionar el id del usuario al que desea cambiarle el estado"
            });
        }

        //obtener datos del usuario a modificar
        let { rows } = await db.query("SELECT id, nombre, estado FROM skaters WHERE id = $1", [id]);

        let usuario = rows[0];

        if (!usuario) {
            return res.status(404).json({
                message: "El usuario que desea modificar no fue encontrado / asegurese de refrescar la página"
            });
        };

        //cambiar el estado del usuario
        let estado = !usuario.estado

        await db.query("UPDATE skaters SET estado = $1 WHERE id = $2", [estado, id]);

        res.status(201).json({
            message: "Usuario modificado con éxito."
        });

    } catch (error) {
        res.status(500).json({
            message: "Error al intentar actualizar el estado del usuario. Vuelva a intentarlo."
        });
    }
});


//Página NOT FOUND para manejo de rutas no encontradas

app.get("*", (req, res) => {
    res.render("Notfound", {
        titulo: "Página no encontrada."
    });
});