import jwt from "jsonwebtoken";

const secretSignature = "secreto";

const verifyToken = (req, res, next) => {
    try {

        let token;

        if(req.query?.token){
            token = req.query.token;
        }else if(req.headers?.authorization){

            token = req.headers.authorization.split(" ")[1];
        }

        if(!token){
            return res.render("error", {
                error: "Recurso protegido, debe contar con credenciales válidas."
            })
        }

        console.log(token);

        let decoded = jwt.verify(token, secretSignature)

        console.log(decoded);
        req.usuario = decoded;

        next();
        
    } catch (error) {
        let message = "Ups! ha ocurrido un error, intente iniciar sesión nuevamente."

        console.log(error);
        if(error.message == "invalid signature"){
            message = "Token inválido o caducado, vuelva a uniciar sesión"
        }else if(error.message == "jwt expired"){
            message = "Su sesión ha expirado, vuelva a iniciar sesión."
        }

        return res.render("error", {
            message
        })
    }
};

export default verifyToken;