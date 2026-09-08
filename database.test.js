const { Client } = require('pg');
const {
  /**
   * Recuperamos el esquema esperado
   *
   * Para una primer etapa, se recomienda importar la propiedad
   * "baseFields" reenombrandola a "expectedFields"
   */
  expectedFields,
} = require('./schema_base');

describe('Test database', () => {
  /**
   * Variables globales usadas por diferentes tests
   */
  let client;

  /**
   * Generamos la configuracion con la base de datos y
   * hacemos la consulta sobre los datos de la tabla "users"
   *
   * Se hace en la etapa beforeAll para evitar relizar la operación
   * en cada test
   */
  beforeAll(async () => {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    await client.connect();
  });

  /**
   * Cerramos la conexion con la base de datos
   */
  afterAll(async () => {
    await client.end();
  });

  /**
   * Validamos el esquema de la base de datos
   */
  describe('Validate database schema', () => {
    /**
     * Variable donde vamos a almacenar los campos
     * recuperados de la base de datos
     */
    let fields;
    let result;

    /**
     * Generamos un objeto para simplificar el acceso en los test
     */
    beforeAll(async () => {
      /**
       * Consulta para recuperar la información de la tabla
       * "users"
       */
      result = await client.query(
        `SELECT
          column_name, data_type
        FROM
          information_schema.columns
        WHERE
          table_name = $1::text`,
        ['users'],
      );

      fields = result.rows.reduce((acc, field) => {
        acc[field.column_name] = field.data_type;
        return acc;
      }, {});
    });

    describe('Validate fields name', () => {
      /**
       * Conjunto de tests para validar que los campos esperados se
       * encuentren presentes
       */
      test.each(expectedFields)('Validate field $name', ({ name }) => {
        expect(Object.keys(fields)).toContain(name);
      });
    });

    describe('Validate fields type', () => {
      /**
       * Conjunto de tests para validar que los campos esperados sean
       * del tipo esperado
       */
      test.each(expectedFields)('Validate field $name to be type "$type"', ({ name, type }) => {
        expect(fields[name]).toBe(type);
      });
    });
  });

  describe('Validate insertion', () => {
    afterEach(async () => {
      await client.query('TRUNCATE users');
    });

    test('Insert a valid user', async () => {
      let result = await client.query(
        `INSERT INTO
         users (email, username, birthdate, city, first_name, last_name, password)
         VALUES ('user@example.com', 'user', '2024-01-02', 'La Plata', 'Nombre', 'Apellido', 'secreto123')`,
      );

      expect(result.rowCount).toBe(1);

      result = await client.query(
        'SELECT * FROM users',
      );

      const user = result.rows[0];
      const userCreatedAt = new Date(user.created_at);
      const currentDate = new Date();

      expect(user.email).toBe('user@example.com');
      expect(userCreatedAt.getFullYear()).toBe(currentDate.getFullYear());
    });

    test('Insert a user with an invalid email', async () => {
      const query = `INSERT INTO
                     users (email, username, birthdate, city, first_name, last_name, password)
                     VALUES ('user', 'user', '2024-01-02', 'La Plata', 'Nombre', 'Apellido', 'secreto123')`;

      await expect(client.query(query)).rejects.toThrow('users_email_check');
    });

    test('Insert a user with an invalid birthdate', async () => {
      const query = `INSERT INTO
                     users (email, username, birthdate, city, first_name, last_name, password)
                     VALUES ('user@example.com', 'user', 'invalid_date', 'La Plata', 'Nombre', 'Apellido', 'secreto123')`;

      await expect(client.query(query)).rejects.toThrow('invalid input syntax for type date');
    });

    test('Insert a user without city', async () => {
      const query = `INSERT INTO
                     users (email, username, birthdate, first_name, last_name, password)
                     VALUES ('user@example.com', 'user', '2024-01-02', 'Nombre', 'Apellido', 'secreto123')`;

      await expect(client.query(query)).rejects.toThrow('null value in column "city"');
    });

    test('Insert a user with first_name at the limit (100 chars)', async () => {
      const longName = 'a'.repeat(100);
      const result = await client.query(
        `INSERT INTO users (email, username, birthdate, city, first_name, last_name, password)
        VALUES ('long@test.com', 'longuser', '2000-01-01', 'City', $1, 'Last', 'password123')`,
        [longName],
      );
      expect(result.rowCount).toBe(1);
    });

    test('Insert a user exceeding first_name limit (101 chars) should fail', async () => {
      const tooLongName = 'a'.repeat(101);
      const query = `INSERT INTO users (email, username, birthdate, city, first_name, last_name, password)
                    VALUES ('toolong@test.com', 'toolong', '2000-01-01', 'City', $1, 'Last', 'password123')`;
      await expect(client.query(query, [tooLongName])).rejects.toThrow('value too long');
    });

    test('Insert a user with password too short (7 chars) should fail', async () => {
      const query = `INSERT INTO users (email, username, birthdate, city, first_name, last_name, password)
                    VALUES ('short@test.com', 'shortpass', '2000-01-01', 'City', 'Name', 'Last', '1234567')`;
      // 'password_min_length' es el nombre que le pusimos al check en el .hcl
      await expect(client.query(query)).rejects.toThrow('password_min_length');
    });

    test('Insert a user without "enabled" field should default to true', async () => {
      await client.query(
        `INSERT INTO users (email, username, birthdate, city, first_name, last_name, password)
        VALUES ('default@test.com', 'defuser', '2000-01-01', 'City', 'Name', 'Last', 'password123')`,
      );
      const res = await client.query('SELECT enabled FROM users WHERE email = $1', ['default@test.com']);
      expect(res.rows[0].enabled).toBe(true);
    });

    test('Insert a user should automatically set updated_at', async () => {
      await client.query(
        `INSERT INTO users (email, username, birthdate, city, first_name, last_name, password)
        VALUES ('time@test.com', 'timeuser', '2000-01-01', 'City', 'Name', 'Last', 'password123')`,
      );
      const res = await client.query('SELECT updated_at FROM users WHERE email = $1', ['time@test.com']);
      expect(res.rows[0].updated_at).not.toBeNull();
    });
  });
});
