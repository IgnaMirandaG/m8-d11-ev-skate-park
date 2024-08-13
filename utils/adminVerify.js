import db from "../database/config.js"
const adminVerify = async (req, res, next) => {
    
    let consulta = {
        text: `SELECT s.id, s.email, s.nombre, a.estado as admin FROM SKATERS s
        INNER JOIN administradores a
        ON s.id = a.id_skater
        WHERE s.id = $1
        `,
        values: [req.usuario.id]
    }

    let {rows} = await db.query(consulta);
    let usuario = rows[0];

    if(!usuario || usuario.admin == false){
        res.render("Error", {
            message: "Usted no es administrador."
        });
    }
    next();
}

export default adminVerify;