CREATE TABLE skaters (
	id SERIAL PRIMARY KEY,
	email VARCHAR(125) NOT NULL UNIQUE,
	nombre VARCHAR(25) NOT NULL,
	password VARCHAR(25) NOT NULL,
	anos_experiencia INT NOT NULL CHECK (anos_experiencia >=0),
	especialidad VARCHAR(50) NOT NULL,
	foto VARCHAR(255) NOT NULL,
	estado BOOLEAN NOT NULL DEFAULT FALSE
);

INSERT INTO skaters VALUES 
(DEFAULT, 'thawks@gmail.com', 'Tony Hawks', '123456', 10, 'Kickflip', 'tony.jpg', true),
('ebouilliart@gmail.com', 'Evelien Bouilliart', '123456', 16, 'Heelflip', 'Evelien.jpg', false);

CREATE TABLE administradores(
	id SERIAL PRIMARY KEY,
	estado BOOLEAN NOT NULL DEFAULT true,
	id_skater INT NOT NULL REFERENCES SKATERS(id)
);

INSERT INTO administradores VALUES
(default, default, 7);

SELECT * FROM skaters;
SELECT * FROM administradores;

SELECT * FROM SKATERS s
INNER JOIN administradores a
ON s.id = a.id_skater;

SELECT S.id, S.nombre, S.email, A.estado AS admin FROM skaters S LEFT JOIN administradores A ON S.id = A.id_skater;