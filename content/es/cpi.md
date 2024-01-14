---
title: Objetivos de las Invocaciones del Programa Cruzado
objectives:
- Explicar las invocaciones de programas cruzados (CPI)
- Describir cómo construir y usar los IPC
- Explicar cómo un programa proporciona una firma para un PDA
- Evite las trampas comunes y solucione los errores comunes asociados con los IPC
---

# TL;DR

-   A **Invocación de programa cruzado (CPI)** es una llamada de un programa a otro, dirigida a una instrucción específica en el programa llamado
-   Los CPI se realizan utilizando los comandos `invoke` o `invoke_signed`, siendo este último la forma en que los programas proporcionan firmas para los PDA que poseen.
-   Los CPI hacen que los programas en el ecosistema de Solana sean completamente interoperables porque todas las instrucciones públicas de un programa pueden ser invocadas por otro programa a través de un CPI.
-   Debido a que no tenemos control sobre las cuentas y los datos enviados a un programa, es importante verificar todos los parámetros pasados a un CPI para garantizar la seguridad del programa.

# Descripción general

## ¿Qué es un CPI?

Una invocación de programa cruzado (CPI) es una llamada directa de un programa a otro. Así como cualquier cliente puede llamar a cualquier programa usando el JSON RPC, cualquier programa puede llamar a cualquier otro programa directamente. El único requisito para invocar una instrucción en otro programa desde dentro de su programa es que construya la instrucción correctamente. Puede crear CPI para programas nativos, otros programas que haya creado y programas de terceros. Los CPI esencialmente convierten todo el ecosistema de Solana en una API gigante que está a su disposición como desarrollador.

Los CPI tienen una composición similar a las instrucciones que está acostumbrado a crear del lado del cliente. Hay algunas complejidades y diferencias dependiendo de si está usando `invoke` o no `invoke_signed`. Cubriremos ambos más adelante en esta lección.

## Cómo hacer un CPI

Los CPI se realizan utilizando la función [ `invoke`](https://docs.rs/solana-program/1.10.19/solana_program/program/fn.invoke.html) o [ `invoke_signed`](https://docs.rs/solana-program/1.10.19/solana_program/program/fn.invoke_signed.html) de la `solana_program` caja. Se utiliza `invoke` para pasar esencialmente a través de la firma de transacción original que se pasó a su programa. Solía `invoke_signed` hacer que su programa "firmara" sus PDA.

```rust
// Used when there are not signatures for PDAs needed
pub fn invoke(
    instruction: &Instruction,
    account_infos: &[AccountInfo<'_>]
) -> ProgramResult

// Used when a program must provide a 'signature' for a PDA, hence the signer_seeds parameter
pub fn invoke_signed(
    instruction: &Instruction,
    account_infos: &[AccountInfo<'_>],
    signers_seeds: &[&[&[u8]]]
) -> ProgramResult
```

Los CPI extienden los privilegios de la persona que llama al destinatario de la llamada. Si la instrucción que el programa llamado está procesando contiene una cuenta que se marcó como firmante o que se puede escribir cuando se pasó originalmente al programa llamante, entonces también se considerará una cuenta firmante o que se puede escribir en el programa invocado.

Es importante tener en cuenta que usted, como desarrollador, decide qué cuentas pasar al IPC. Puede pensar en un CPI como construir otra instrucción desde cero con solo la información que se pasó a su programa.

### CPI con `invoke`

```rust
invoke(
    &Instruction {
        program_id: calling_program_id,
        accounts: accounts_meta,
        data,
    },
    &account_infos[account1.clone(), account2.clone(), account3.clone()],
)?;
```

-   `program_id` - la clave pública del programa que va a invocar
-   `account` - una lista de metadatos de cuenta como vector. Debe incluir todas las cuentas que el programa invocado leerá o escribirá
-   `data` - una memoria intermedia de bytes que representa los datos que se pasan al programa llamado como un vector

El `Instruction` tipo tiene la siguiente definición:

```rust
pub struct Instruction {
    pub program_id: Pubkey,
    pub accounts: Vec<AccountMeta>,
    pub data: Vec<u8>,
}
```

Dependiendo del programa al que esté haciendo la llamada, puede haber una caja disponible con funciones de ayuda para crear el `Instruction` objeto. Muchas personas y organizaciones crean cajas disponibles públicamente junto con sus programas que exponen este tipo de funciones para simplificar las llamadas a sus programas. Esto es similar a las bibliotecas de Typescript que hemos utilizado en este curso (por ejemplo[@solana/web3.js](https://solana-labs.github.io/solana-web3.js/),[@solana/spl-token](https://solana-labs.github.io/solana-program-library/token/js/)). Por ejemplo, en la demostración de esta lección usaremos la `spl_token` caja para crear instrucciones de acuñación. En todos los demás casos, deberá crear la `Instruction` instancia desde cero.

Si bien el `program_id` campo es bastante sencillo, los `data` campos `accounts` y requieren alguna explicación.

Ambos `data` campos `accounts` y son de tipo `Vec`, o vector. Puede usar la macro [ `vec`](https://doc.rust-lang.org/std/macro.vec.html) para construir un vector usando notación de matriz, de la siguiente manera:

```rust
let v = vec![1, 2, 3];
assert_eq!(v[0], 1);
assert_eq!(v[1], 2);
assert_eq!(v[2], 3);
```

El `accounts` campo de la `Instruction` estructura espera un vector de tipo [ `AccountMeta`](https://docs.rs/solana-program/latest/solana_program/instruction/struct.AccountMeta.html). La `AccountMeta` estructura tiene la siguiente definición:

```rust
pub struct AccountMeta {
    pub pubkey: Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
}
```

Poner estas dos piezas juntas se ve así:

```rust
use solana_program::instruction::AccountMeta;

vec![
    AccountMeta::new(account1_pubkey, true),
    AccountMeta::read_only(account2_pubkey, false),
    AccountMeta::read_only(account3_pubkey, true),
    AccountMeta::new(account4_pubkey, false),
]
```

El campo final del objeto de instrucción son los datos, como un búfer de bytes, por supuesto. Puede crear un búfer de bytes en Rust usando la `vec` macro nuevamente, que tiene una función implementada que le permite crear un vector de cierta longitud. Una vez que haya inicializado un vector vacío, construirá el búfer de bytes de manera similar a como lo haría con el lado del cliente. Determine los datos requeridos por el programa llamado y el formato de serialización utilizado y escriba su código para que coincida. Siéntase libre de leer sobre algunas de las [características de la `vec` macro disponibles aquí](https://doc.rust-lang.org/alloc/vec/struct.Vec.html#).

```rust
let mut vec = Vec::with_capacity(3);
vec.push(1);
vec.push(2);
vec.extend_from_slice(&number_variable.to_le_bytes());
```

El método [ `extend_from_slice`](https://doc.rust-lang.org/alloc/vec/struct.Vec.html#method.extend_from_slice) es probablemente nuevo para usted. Es un método en vectores que toma una rebanada como entrada, itera sobre la rebanada, clona cada elemento y luego lo agrega a `Vec`.

### Pasar una lista de cuentas

Además de la instrucción, ambos `invoke` y `invoke_signed` también requieren una lista de `account_info` objetos. Al igual que la lista de `AccountMeta` objetos que agregó a la instrucción, debe incluir todas las cuentas que el programa al que llama leerá o escribirá.

Para cuando realice un IPC en su programa, ya debería haber tomado todos los `account_info` objetos que se pasaron a su programa y almacenarlos en variables. Construirá su lista de `account_info` objetos para el CPI eligiendo cuál de estas cuentas copiar y enviar.

Puede copiar cada `account_info` objeto que necesita pasar al CPI utilizando el rasgo [ `Clone`](https://docs.rs/solana-program/1.10.19/solana_program/account_info/structuret.AccountInfo.html#impl-Clone) que se implementa en la `account_info` estructura en la `solana_program` caja. Este `Clone` rasgo devuelve una copia de la instancia [ `account_info`](https://docs.rs/solana-program/1.10.19/solana_program/account_info/structuret.AccountInfo.html).

```rust
&[first_account.clone(), second_account.clone(), third_account.clone()]
```

### CPI con `invoke`

Con la instrucción y la lista de cuentas creadas, puede realizar una llamada a `invoke`.

```rust
invoke(
    &Instruction {
        program_id: calling_program_id,
        accounts: accounts_meta,
        data,
    },
    &[account1.clone(), account2.clone(), account3.clone()],
)?;
```

No es necesario incluir una firma porque el tiempo de ejecución de Solana pasa a lo largo de la firma original pasada a su programa. Recuerde, no `invoke` funcionará si se requiere una firma en nombre de un PDA. Para eso, necesitarás usar `invoke_signed`.

### CPI con `invoke_signed`

El uso `invoke_signed` es un poco diferente solo porque hay un campo adicional que requiere las semillas utilizadas para derivar cualquier PDA que deba firmar la transacción. Puede recordar de lecciones anteriores que las PDA no se encuentran en la curva Ed25519 y, por lo tanto, no tienen una clave privada correspondiente. Le han dicho que los programas pueden proporcionar firmas para sus PDA, pero no han aprendido cómo sucede eso realmente, hasta ahora. Los programas proporcionan firmas para sus PDA con la `invoke_signed` función. Los dos primeros campos de `invoke_signed` son los mismos que `invoke`, pero hay un `signers_seeds` campo adicional que entra en juego aquí.

```rust
invoke_signed(
    &instruction,
    accounts,
    &[&["First addresses seed"],
        &["Second addresses first seed",
        "Second addresses second seed"]],
)?;
```

Si bien los PDA no tienen claves privadas propias, pueden ser utilizados por un programa para emitir una instrucción que incluya el PDA como firmante. La única manera de que el tiempo de ejecución verifique que el PDA pertenece al programa llamante es que el programa llamante suministre las semillas utilizadas para generar la dirección en el `signers_seeds` campo.

El tiempo de ejecución de Solana llamará internamente a [ `create_program_address`](https://docs.rs/solana-program/1.4.4/solana_program/pubkey/structuret.Pubkey.html#method.create_program_address) utilizando las semillas proporcionadas y el programa `program_id` de llamada. A continuación, puede comparar el resultado con las direcciones suministradas en la instrucción. Si alguna de las direcciones coincide, entonces el tiempo de ejecución sabe que, de hecho, el programa asociado con esta dirección es la persona que llama y, por lo tanto, está autorizado para ser un firmante.

## Mejores prácticas y trampas comunes

### Controles de seguridad

Hay algunos errores comunes y cosas que debe recordar al utilizar los CPI que son importantes para la seguridad y robustez de su programa. Lo primero que hay que recordar es que, como ya sabemos, no tenemos control sobre qué información se pasa a nuestros programas. Por esta razón, es importante verificar siempre las cuentas `program_id` y los datos pasados al IPC. Sin estos controles de seguridad, alguien podría enviar una transacción que invoque una instrucción en un programa completamente diferente de lo esperado, lo que no es ideal.

Afortunadamente, existen comprobaciones inherentes sobre la validez de cualquier PDA que esté marcado como firmante dentro de la `invoke_signed` función. Todas las demás cuentas y `instruction_data` deben verificarse en algún lugar del código de su programa antes de realizar el IPC. También es importante asegurarse de que está apuntando a la instrucción prevista en el programa que está invocando. La forma más fácil de hacerlo es leer el código fuente del programa que va a invocar tal como lo haría si estuviera construyendo una instrucción desde el lado del cliente.

### Errores comunes

Hay algunos errores comunes que puede recibir al ejecutar un CPI, generalmente significan que está construyendo el CPI con información incorrecta. Por ejemplo, puede encontrar un mensaje de error similar a este:

```text
EF1M4SPfKcchb6scq297y8FPCaLvj5kGjwMzjTM68wjA's signer privilege escalated
Program returned error: "Cross-program invocation with unauthorized signer or writable account"
```

Este mensaje es un poco engañoso, porque "privilegio del firmante escalado" no parece un problema, pero, en realidad, significa que está firmando incorrectamente la dirección en el mensaje. Si está usando `invoke_signed` y recibe este error, entonces probablemente significa que las semillas que está proporcionando son incorrectas. Se puede encontrar una transacción de ejemplo que falló con este error[here](https://explorer.solana.com/tx/3mxbShkerH9ZV1rMmvDfaAhLhJJqrmMjcsWzanjkARjBQurhf4dounrDCUkGunH1p9M4jEwef9parueyHVw6r2Et?cluster=devnet).

Otro error similar se produce cuando una cuenta en la que está escrita no está marcada como `writable` dentro de la `AccountMeta` estructura.

```text
2qoeXa9fo8xVHzd2h9mVcueh6oK3zmAiJxCTySM5rbLZ's writable privilege escalated
Program returned error: "Cross-program invocation with unauthorized signer or writable account"
```

Recuerde, cualquier cuenta cuyos datos puedan ser mutados por el programa durante la ejecución debe especificarse como escribible. Durante la ejecución, escribir en una cuenta que no se especificó como escribible hará que la transacción falle. Escribir en una cuenta que no es propiedad del programa hará que la transacción falle. Cualquier cuenta cuyo saldo lamport pueda ser mutado por el programa durante la ejecución debe especificarse como escribible. Durante la ejecución, la mutación de los lamports de una cuenta que no se especificó como escribible hará que la transacción falle. Si bien restar lamports de una cuenta que no es propiedad del programa hará que la transacción falle, se permite agregar lamports a cualquier cuenta, siempre que sea mutable.

Para ver esto en acción, vea esto[transacción en el explorador](https://explorer.solana.com/tx/ExB9YQJiSzTZDBqx4itPaa4TpT8VK4Adk7GU5pSoGEzNz9fa7PPZsUxssHGrBbJRnCvhoKgLCWnAycFB7VYDbBg?cluster=devnet).

## ¿Por qué son importantes los CPI?

Los CPI son una característica muy importante del ecosistema de Solana y hacen que todos los programas desplegados sean interoperables entre sí. Con los IPC no hay necesidad de reinventar la rueda cuando se trata de desarrollo. Esto crea la oportunidad de construir nuevos protocolos y aplicaciones sobre lo que ya se ha construido, al igual que los bloques de construcción o los ladrillos de Lego. ¡Es importante recordar que los CPI son una calle de doble sentido y lo mismo es cierto para cualquier programa que implemente! Si construyes algo genial y útil, los desarrolladores tienen la capacidad de construir sobre lo que has hecho o simplemente conectar tu protocolo a lo que sea que estén construyendo. La composibilidad es una gran parte de lo que hace que las criptomonedas sean tan únicas y los IPC son lo que hace que esto sea posible en Solana.

Otro aspecto importante de los CPI es que permiten que los programas firmen sus PDA. Como probablemente ya habrás notado, los PDA se utilizan con mucha frecuencia en el desarrollo de Solana porque permiten a los programas controlar direcciones específicas de tal manera que ningún usuario externo puede generar transacciones con firmas válidas para esas direcciones. Esto puede ser _muy_ útil para muchas aplicaciones en Web3 (por ejemplo, DeFi, NFT, etc. Sin los CPI, los PDA no serían tan útiles porque no habría forma de que un programa firmara transacciones que los involucraran, esencialmente convirtiéndolos en agujeros negros (una vez que algo se envía a un PDA, ¡no habría forma de recuperarlo sin CPI!)

# Demostración

Ahora vamos a obtener un poco de experiencia práctica con los IPC haciendo algunas adiciones al programa de revisión de películas de nuevo. Si estás entrando en esta lección sin haber pasado por lecciones anteriores, el programa Movie Review permite a los usuarios enviar reseñas de películas y almacenarlas en cuentas PDA.

En la última lección, añadimos la posibilidad de dejar comentarios en otras reseñas de películas usando PDA. En esta lección, vamos a trabajar para tener los tokens Mint del programa para el revisor o comentarista cada vez que se envíe una revisión o comentario.

Para implementar esto, tendremos que invocar la `MintTo` instrucción del Programa de tokens SPL utilizando un CPI. Si necesita un repaso de tokens, fichas de acuñación y acuñar nuevos tokens, eche un vistazo a la [Lección del programa de fichas](./token-program) antes de seguir adelante con esta demostración.

### 1. Obtener código de inicio y añadir dependencias

Para empezar, utilizaremos el estado final del programa de revisión de películas de la lección PDA anterior. Entonces, si acabas de completar esa lección, entonces estás listo y listo para comenzar. Si solo estás saltando aquí, no te preocupes, puedes[descarga el código de inicio aquí](https://github.com/Unboxed-Software/solana-movie-program/tree/solution-add-comments). Usaremos la `solution-add-comments` sucursal como punto de partida.

### 2. Añadir dependencias a `Cargo.toml`

Antes de empezar tenemos que añadir dos nuevas dependencias al `Cargo.toml` archivo de abajo `[dependencies]`. Utilizaremos las `spl-associated-token-account` cajas `spl-token` y además de las dependencias existentes.

```text
spl-token = { version="~3.2.0", features = [ "no-entrypoint" ] }
spl-associated-token-account = { version="=1.0.5", features = [ "no-entrypoint" ] }
```

Después de añadir lo anterior, ejecute `cargo check` en su consola para que cargo resuelva sus dependencias y asegúrese de que está listo para continuar. Dependiendo de su configuración, es posible que deba modificar las versiones de la caja antes de continuar.

### 3. Añadir cuentas necesarias a `add_movie_review`

Debido a que queremos que los usuarios sean fichas acuñadas al crear una revisión, tiene sentido agregar lógica de acuñación dentro de la `add_movie_review` función. Dado que estaremos acuñando tokens, la `add_movie_review` instrucción requiere que se pasen algunas cuentas nuevas:

-   `token_mint` - la dirección Mint del token
-   `mint_auth` - dirección de la autoridad del token Mint
-   `user_ata` - la cuenta de token asociada del usuario para esta menta (donde se acuñarán los tokens)
-   `token_program` - dirección del programa token

Comenzaremos añadiendo estas nuevas cuentas al área de la función que itera a través de las cuentas pasadas:

```rust
// Inside add_movie_review
msg!("Adding movie review...");
msg!("Title: {}", title);
msg!("Rating: {}", rating);
msg!("Description: {}", description);

let account_info_iter = &mut accounts.iter();

let initializer = next_account_info(account_info_iter)?;
let pda_account = next_account_info(account_info_iter)?;
let pda_counter = next_account_info(account_info_iter)?;
let token_mint = next_account_info(account_info_iter)?;
let mint_auth = next_account_info(account_info_iter)?;
let user_ata = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
let token_program = next_account_info(account_info_iter)?;
```

No se `instruction_data` requieren cambios adicionales para la nueva funcionalidad, por lo que no es necesario realizar cambios en la forma en que se deserializan los datos. La única información adicional que se necesita son las cuentas adicionales.

### 4. Tokens de menta para el revisor en `add_movie_review`

Antes de sumergirnos en la lógica de acuñación, vamos a importar la dirección del programa Token y la constante `LAMPORTS_PER_SOL` en la parte superior del archivo.

```rust
// Inside processor.rs
use solana_program::native_token::LAMPORTS_PER_SOL;
use spl_associated_token_account::get_associated_token_address;
use spl_token::{instruction::initialize_mint, ID as TOKEN_PROGRAM_ID};
```

¡Ahora podemos pasar a la lógica que maneja la acuñación real de las fichas! Añadiremos esto al final de la `add_movie_review` función justo antes de que `Ok(())` se devuelva.

Los tokens de acuñación requieren una firma de la autoridad de la ceca. Dado que el programa debe poder acuñar tokens, la autoridad Mint debe ser una cuenta por la que el programa pueda firmar. En otras palabras, debe ser una cuenta PDA propiedad del programa.

También estructuraremos nuestro token Mint de tal manera que la cuenta Mint sea una cuenta PDA que podamos derivar de manera determinista. De esta manera siempre podemos verificar que la `token_mint` cuenta que se pasa al programa es la cuenta esperada.

Sigamos adelante y deduzcamos las direcciones de autoridad de token Mint y Mint utilizando la `find_program_address` función con las semillas "token_mint" y "token_auth", respectivamente.

```rust
// Mint tokens here
msg!("deriving mint authority");
let (mint_pda, mint_bump) = Pubkey::find_program_address(&[b"token_mint"], program_id);
let (mint_auth_pda, _mint_auth_bump) =
    Pubkey::find_program_address(&[b"token_auth"], program_id);
```

A continuación, realizaremos comprobaciones de seguridad contra cada una de las nuevas cuentas pasadas al programa. ¡Siempre recuerde verificar las cuentas!

```rust
if *token_mint.key != mint_pda {
    msg!("Incorrect token mint");
    return Err(ReviewError::IncorrectAccountError.into());
}

if *mint_auth.key != mint_auth_pda {
    msg!("Mint passed in and mint derived do not match");
    return Err(ReviewError::InvalidPDA.into());
}

if *user_ata.key != get_associated_token_address(initializer.key, token_mint.key) {
    msg!("Incorrect token mint");
    return Err(ReviewError::IncorrectAccountError.into());
}

if *token_program.key != TOKEN_PROGRAM_ID {
    msg!("Incorrect token program");
    return Err(ReviewError::IncorrectAccountError.into());
}
```

Finalmente, podemos emitir un CPI a la `mint_to` función del programa token con las cuentas correctas usando `invoke_signed`. La `spl_token` caja proporciona una función de `mint_to` ayuda para crear la instrucción de acuñación. Esto es genial porque significa que no tenemos que construir manualmente toda la instrucción desde cero. Más bien, podemos simplemente pasar en los argumentos requeridos por la función. Aquí está la firma de la función:

```rust
// Inside the token program, returns an Instruction object
pub fn mint_to(
    token_program_id: &Pubkey,
    mint_pubkey: &Pubkey,
    account_pubkey: &Pubkey,
    owner_pubkey: &Pubkey,
    signer_pubkeys: &[&Pubkey],
    amount: u64,
) -> Result<Instruction, ProgramError>
```

A continuación, proporcionamos copias de la `token_mint`, `user_ata`, y `mint_auth` cuentas. Y, lo más relevante para esta lección, proporcionamos las semillas utilizadas para encontrar la `token_mint` dirección, incluida la semilla de protuberancia.

```rust
msg!("Minting 10 tokens to User associated token account");
invoke_signed(
    // Instruction
    &spl_token::instruction::mint_to(
        token_program.key,
        token_mint.key,
        user_ata.key,
        mint_auth.key,
        &[],
        10*LAMPORTS_PER_SOL,
    )?,
    // Account_infos
    &[token_mint.clone(), user_ata.clone(), mint_auth.clone()],
    // Seeds
    &[&[b"token_mint", &[mint_bump]]],
)?;

Ok(())
```

Tenga en cuenta que estamos usando `invoke_signed` y no `invoke` aquí. El programa Token requiere que la `mint_auth` cuenta firme esta transacción. Dado que la `mint_auth` cuenta es un PDA, solo el programa del que se derivó puede firmar en su nombre. Cuando `invoke_signed` se llama, el tiempo de ejecución de Solana llama `create_program_address` con las semillas y el bache proporcionados y luego compara la dirección derivada con todas las direcciones de los `AccountInfo` objetos proporcionados. Si alguna de las direcciones coincide con la dirección derivada, el tiempo de ejecución sabe que la cuenta coincidente es un PDA de este programa y que el programa está firmando esta transacción para esta cuenta.

En este punto, la `add_movie_review` instrucción debe ser completamente funcional y acuñará diez fichas para el revisor cuando se cree una revisión.

### 5. Repetir para `add_comment`

Nuestras actualizaciones a la `add_comment` función serán casi idénticas a lo que hicimos para la `add_movie_review` función anterior. La única diferencia es que cambiaremos la cantidad de tokens acuñados para un comentario de diez a cinco para que la adición de comentarios se ponderen por encima de los comentarios. Primero, actualice las cuentas con las mismas cuatro cuentas adicionales que en la `add_movie_review` función.

```rust
// Inside add_comment
let account_info_iter = &mut accounts.iter();

let commenter = next_account_info(account_info_iter)?;
let pda_review = next_account_info(account_info_iter)?;
let pda_counter = next_account_info(account_info_iter)?;
let pda_comment = next_account_info(account_info_iter)?;
let token_mint = next_account_info(account_info_iter)?;
let mint_auth = next_account_info(account_info_iter)?;
let user_ata = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
let token_program = next_account_info(account_info_iter)?;
```

A continuación, muévase a la parte inferior de la `add_comment` función justo antes de la `Ok(())`. A continuación, obtenga el token Mint y las cuentas de autoridad Mint. Recuerde, ambos son PDA derivados de las semillas "token_mint" y "token_authority" respectivamente.

```rust
// Mint tokens here
msg!("deriving mint authority");
let (mint_pda, mint_bump) = Pubkey::find_program_address(&[b"token_mint"], program_id);
let (mint_auth_pda, _mint_auth_bump) =
    Pubkey::find_program_address(&[b"token_auth"], program_id);
```

A continuación, verifique que cada una de las nuevas cuentas sea la cuenta correcta.

```rust
if *token_mint.key != mint_pda {
    msg!("Incorrect token mint");
    return Err(ReviewError::IncorrectAccountError.into());
}

if *mint_auth.key != mint_auth_pda {
    msg!("Mint passed in and mint derived do not match");
    return Err(ReviewError::InvalidPDA.into());
}

if *user_ata.key != get_associated_token_address(commenter.key, token_mint.key) {
    msg!("Incorrect token mint");
    return Err(ReviewError::IncorrectAccountError.into());
}

if *token_program.key != TOKEN_PROGRAM_ID {
    msg!("Incorrect token program");
    return Err(ReviewError::IncorrectAccountError.into());
}
```

Finalmente, utilice `invoke_signed` para enviar la `mint_to` instrucción al programa Token, enviando cinco tokens al comentarista.

```rust
msg!("Minting 5 tokens to User associated token account");
invoke_signed(
    // Instruction
    &spl_token::instruction::mint_to(
        token_program.key,
        token_mint.key,
        user_ata.key,
        mint_auth.key,
        &[],
        5 * LAMPORTS_PER_SOL,
    )?,
    // Account_infos
    &[token_mint.clone(), user_ata.clone(), mint_auth.clone()],
    // Seeds
    &[&[b"token_mint", &[mint_bump]]],
)?;

Ok(())
```

### 6. Configurar el token Mint

Hemos escrito todo el código necesario para mint tokens a los revisores y comentaristas, pero todo esto asume que hay un token mint en el PDA derivado con la semilla "token_mint". "Para que esto funcione, vamos a configurar una instrucción adicional para inicializar el token Mint. Se escribirá de tal manera que solo se pueda llamar una vez y no importa particularmente quién lo llame.

Dado que a lo largo de esta lección ya hemos martillado a casa todos los conceptos asociados con PDAs y CPIs varias veces, vamos a caminar a través de este bit con menos explicación que los pasos anteriores. Comience añadiendo una cuarta variante de instrucción a la `MovieInstruction` enumeración `instruction.rs`.

```rust
pub enum MovieInstruction {
    AddMovieReview {
        title: String,
        rating: u8,
        description: String,
    },
    UpdateMovieReview {
        title: String,
        rating: u8,
        description: String,
    },
    AddComment {
        comment: String,
    },
    InitializeMint,
}
```

Asegúrese de añadirlo a la `match` instrucción en la `unpack` función en el mismo archivo bajo la variante `3`.

```rust
impl MovieInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&variant, rest) = input
            .split_first()
            .ok_or(ProgramError::InvalidInstructionData)?;
        Ok(match variant {
            0 => {
                let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
                Self::AddMovieReview {
                    title: payload.title,
                    rating: payload.rating,
                    description: payload.description,
                }
            }
            1 => {
                let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
                Self::UpdateMovieReview {
                    title: payload.title,
                    rating: payload.rating,
                    description: payload.description,
                }
            }
            2 => {
                let payload = CommentPayload::try_from_slice(rest).unwrap();
                Self::AddComment {
                    comment: payload.comment,
                }
            }
            3 => Self::InitializeMint,
            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }
}
```

En la `process_instruction` función del `processor.rs` archivo, añada la nueva instrucción a la `match` instrucción y llame a una función `initialize_token_mint`.

```rust
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = MovieInstruction::unpack(instruction_data)?;
    match instruction {
        MovieInstruction::AddMovieReview {
            title,
            rating,
            description,
        } => add_movie_review(program_id, accounts, title, rating, description),
        MovieInstruction::UpdateMovieReview {
            title,
            rating,
            description,
        } => update_movie_review(program_id, accounts, title, rating, description),
        MovieInstruction::AddComment { comment } => add_comment(program_id, accounts, comment),
        MovieInstruction::InitializeMint => initialize_token_mint(program_id, accounts),
    }
}
```

Por último, declarar e implementar la `initialize_token_mint` función. Esta función derivará los PDA de autoridad de token Mint y Mint, creará la cuenta de token Mint y luego inicializará el token Mint. No explicaremos todo esto en detalle, pero vale la pena leer el código, especialmente dado que la creación e inicialización del token Mint involucran CPI. Una vez más, si necesita un repaso de tokens y mentas, eche un vistazo a la[Lección del programa de fichas](./token-program).

```rust
pub fn initialize_token_mint(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();

    let initializer = next_account_info(account_info_iter)?;
    let token_mint = next_account_info(account_info_iter)?;
    let mint_auth = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let sysvar_rent = next_account_info(account_info_iter)?;

    let (mint_pda, mint_bump) = Pubkey::find_program_address(&[b"token_mint"], program_id);
    let (mint_auth_pda, _mint_auth_bump) =
        Pubkey::find_program_address(&[b"token_auth"], program_id);

    msg!("Token mint: {:?}", mint_pda);
    msg!("Mint authority: {:?}", mint_auth_pda);

    if mint_pda != *token_mint.key {
        msg!("Incorrect token mint account");
        return Err(ReviewError::IncorrectAccountError.into());
    }

    if *token_program.key != TOKEN_PROGRAM_ID {
        msg!("Incorrect token program");
        return Err(ReviewError::IncorrectAccountError.into());
    }

    if *mint_auth.key != mint_auth_pda {
        msg!("Incorrect mint auth account");
        return Err(ReviewError::IncorrectAccountError.into());
    }

    let rent = Rent::get()?;
    let rent_lamports = rent.minimum_balance(82);

    invoke_signed(
        &system_instruction::create_account(
            initializer.key,
            token_mint.key,
            rent_lamports,
            82,
            token_program.key,
        ),
        &[
            initializer.clone(),
            token_mint.clone(),
            system_program.clone(),
        ],
        &[&[b"token_mint", &[mint_bump]]],
    )?;

    msg!("Created token mint account");

    invoke_signed(
        &initialize_mint(
            token_program.key,
            token_mint.key,
            mint_auth.key,
            Option::None,
            9,
        )?,
        &[token_mint.clone(), sysvar_rent.clone(), mint_auth.clone()],
        &[&[b"token_mint", &[mint_bump]]],
    )?;

    msg!("Initialized token mint");

    Ok(())
}
```

### 7. Construir e implementar

¡Ahora estamos listos para construir y desplegar nuestro programa! Puede construir el programa ejecutando `cargo build-bpf` y luego ejecutando el comando que se devuelve, debería verse algo así `solana program deploy <PATH>`.

Antes de que pueda comenzar a probar si agregar una revisión o comentario le envía tokens, debe inicializar el token Mint del programa. Puedes usarlo [este script](https://github.com/Unboxed-Software/solana-movie-token-client) para hacer eso. Una vez que haya clonado ese repositorio, reemplace el `PROGRAM_ID` en `index.ts` con el ID de su programa. Entonces corre `npm install` y luego `npm start`. El script asume que se está implementando en Devnet. Si está implementando localmente, asegúrese de adaptar el script en consecuencia.

Una vez que haya inicializado su token Mint, puede usar el [Frontend de revisión de películas](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-add-tokens) para probar añadiendo revisiones y comentarios. Una vez más, el código asume que estás en Devnet, así que actúa en consecuencia.

Después de enviar una reseña, ¡deberías ver 10 nuevos tokens en tu billetera! Cuando añades un comentario, deberías recibir 5 tokens. No tendrán un nombre o imagen elegante ya que no añadimos ningún metadato al token, pero tienes la idea.

Si necesita más tiempo con los conceptos de esta lección o se quedó atascado en el camino, siéntase libre de hacerlo[echa un vistazo al código de la solución](https://github.com/Unboxed-Software/solana-movie-program/tree/solution-add-tokens). Tenga en cuenta que la solución a esta demostración está en la `solution-add-tokens` rama.

# Desafío

Para aplicar lo que ha aprendido sobre los IPC en esta lección, piense en cómo podría incorporarlos al programa Student Intro. Podrías hacer algo similar a lo que hicimos en la demostración aquí y agregar alguna funcionalidad a los tokens Mint a los usuarios cuando se presenten. O si te sientes realmente ambicioso, piensa en cómo podrías tomar todo lo que has aprendido hasta ahora en el curso y crear algo completamente nuevo desde cero.

Un gran ejemplo sería construir un desbordamiento de pila descentralizado. El programa podría usar tokens para determinar la calificación general de un usuario, tokens Mint cuando las preguntas se responden correctamente, permitir a los usuarios votar por las respuestas, etc. ¡Todo eso es posible y ahora tienes las habilidades y el conocimiento para construir algo así por tu cuenta!

¡Felicidades por llegar al final del Módulo 4! Siéntase libre de compartir algunos comentarios rápidos[here](https://airtable.com/shrOsyopqYlzvmXSC?prefill_Module=Module%204), para que podamos seguir mejorando el curso.
