# Invocaciones de Programas Cruzados
## Objetivos de la Lección

*Al final de esta lección, podrá:*
- Explicar las invocaciones de programas cruzados (CPI)
- Describir cómo construir y utilizar las CPI
- Explicar cómo un programa proporciona una firma para un PDA
- Evitar trampas comunes y solucionar errores comunes asociados con las CPI

# Terminología 

- Una **invocación de programa cruzado (CPI)** es una llamada de un programa a otro, dirigiéndose a una instrucción específica del programa llamado.
- Las CPI se realizan utilizando los comandos **invoke** o **invoke_signed** , siendo este último cómo los programas proporcionan firmas para las PDA que poseen.
- Las CPI hacen que los programas en el ecosistema Solana sean completamente interoperables, ya que todas las instrucciones públicas de un programa pueden ser invocadas por otro programa mediante una CPI.
- Debido a que no tenemos control sobre las cuentas y los datos presentados a un programa, es importante verificar todos los parámetros pasados en una CPI para garantizar la seguridad del programa.


# Resumen
## ¿Qué es una CPI?
Una invocación de programa cruzado (CPI) es una llamada directa de un programa a otro. Al igual que cualquier cliente puede llamar a cualquier programa utilizando el JSON RPC, cualquier programa puede llamar directamente a cualquier otro programa. El único requisito para invocar una instrucción en otro programa desde su programa es que construya la instrucción correctamente. Puede hacer CPI a programas nativos, otros programas que ha creado y programas de terceros. Las CPI esencialmente convierten todo el ecosistema Solana en una gran API que está a su disposición como desarrollador.
Las CPI tienen una estructura similar a las instrucciones a las que está acostumbrado a crear en el lado del cliente. Hay algunas complejidades y diferencias dependiendo de si está utilizando **invoke** o **invoke_signed** . Cubriremos ambos más adelante en esta lección.

## Cómo hacer una CPI
Las CPI se hacen usando la función [invoke](https://docs.rs/solana-program/1.10.19/solana_program/program/fn.invoke.html) o [invoke_signed](https://docs.rs/solana-program/1.10.19/solana_program/program/fn.invoke_signed.html) desde la biblioteca **solana_program** . Utilizas **invoke** para, esencialmente, pasar a través de la firma original de la transacción que se pasó a tu programa. Utilizas **invoke_signed** para que tu programa "firme" por sus PDA.

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

Las CPI extienden los privilegios del llamador al llamado. Si la instrucción que el programa llamado está procesando contiene una cuenta que se marcó como firmante o escribible cuando se pasó originalmente al programa llamador, entonces también se considerará una cuenta de firma o escritura en el programa invocado.
Es importante tener en cuenta que usted como desarrollador decide qué cuentas pasar en la CPI. Puede pensar en una CPI como si construyera otra instrucción desde cero con solo la información que se pasó a su programa.

### **Invoke** con CPI

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

- **program_id** : la clave pública del programa al que se va a invocar
- **cuenta** : una lista de metadatos de cuenta como un vector. Debe incluir cada cuenta de la que el programa invocado leerá o escribirá
- **datos** : un búfer de bytes que representa los datos que se pasan al programa llamado como un vector.

El tipo **Instrucción** tiene la siguiente definición:

```rust
pub struct Instruction {
    pub program_id: Pubkey,
    pub accounts: Vec<AccountMeta>,
    pub data: Vec<u8>,
}
```

Dependiendo del programa al que está haciendo la llamada, puede haber una biblioteca disponible con funciones de ayuda para crear el objeto **Instruction**. Muchas personas e instituciones crean bibliotecas públicas junto con sus programas que exponen estos tipos de funciones para simplificar la llamada a sus programas. Esto es similar a las bibliotecas de Typescript que hemos utilizado en este curso (por ejemplo, **@solana/web3.js, @solana/spl-token** ). Por ejemplo, en la demostración de esta lección, utilizaremos la biblioteca **spl_token** para crear instrucciones de acuñación. En todos los demás casos, deberá crear la instancia de **Instruction** desde cero.

Aunque el campo **program_id** es bastante sencillo, los campos de **accounts** y **data** requieren alguna explicación.

Tanto los campos de **accounts** como los de **data** son de tipo **Vec** , o vector. Puede usar el macro **vec** para construir un vector utilizando la notación de matrices, de la siguiente manera:

```rust
let v = vec![1, 2, 3];
assert_eq!(v[0], 1);
assert_eq!(v[1], 2);
assert_eq!(v[2], 3);
```

El campo de **accounts** de la estructura **Instruction** espera un vector de tipo **AccountMeta** . La estructura **AccountMeta** tiene la siguiente definición:

```rust
let v = vec![1, 2, 3];
assert_eq!(v[0], 1);
assert_eq!(v[1], 2);
assert_eq!(v[2], 3);
```

Juntar estas dos piezas se ve así:

```rust
use solana_program::instruction::AccountMeta;

vec![
    AccountMeta::new(account1_pubkey, true),
    AccountMeta::read_only(account2_pubkey, false),
    AccountMeta::read_only(account3_pubkey, true),
    AccountMeta::new(account4_pubkey, false),
]
```




El campo final del objeto de instrucción es el dato, como un búfer de bytes, por supuesto. Puede crear un búfer de bytes en Rust utilizando el macro **vec** nuevamente, el cual tiene una función implementada que le permite crear un vector de cierto tamaño. Una vez que ha inicializado un vector vacío, construiría el búfer de bytes similar a cómo lo haría en el lado del cliente. Determine los datos requeridos por el programa llamado y el formato de serialización utilizado y escriba su código para que coincida. No dude en leer sobre algunas de las características del [macro vec disponibles para usted aquí](https://doc.rust-lang.org/alloc/vec/struct.Vec.html#).

```rust
let mut vec = Vec::with_capacity(3);
vec.push(1);
vec.push(2);
vec.extend_from_slice(&number_variable.to_le_bytes());
```

El método [extend_from_slice](https://doc.rust-lang.org/alloc/vec/struct.Vec.html#method.extend_from_slice) probablemente es nuevo para usted. Es un método en vectores que toma una porción como entrada, itera sobre la porción, clona cada elemento y luego lo agrega al **Vec** .

### Pasar una lista de cuentas
Además de la instrucción, tanto **invoke** como **invoke_signed** también requieren una lista de objetos **account_info** . Al igual que la lista de objetos **AccountMeta** que agregó a la instrucción, debe incluir todas las cuentas de las que el programa al que está llamando leerá o escribirá.

Al momento de hacer una CPI en su programa, ya debería haber obtenido todos los objetos **account_info** que se pasaron a su programa y almacenarlos en variables. Construirá su lista de objetos **account_info** para la CPI eligiendo qué cuentas copiar y enviar.

Puede copiar cada objeto **account_info** que necesite pasar a la CPI utilizando el trait **Clone** que se implementa en la estructura **account_info** de la biblioteca **solana_program** . Este trait **Clone** devuelve una copia de la instancia [account_info](https://docs.rs/solana-program/1.10.19/solana_program/account_info/struct.AccountInfo.html).

```rust
&[first_account.clone(), second_account.clone(), third_account.clone()]
```

### CPI con **invoke**
Con tanto la instrucción como la lista de cuentas creadas, puede realizar una llamada a **invoke**.

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

No es necesario incluir una firma, ya que el tiempo de ejecución Solana pasa junto con la firma original pasada a su programa. Recuerde, **invoke** no funcionará si se requiere una firma en nombre de una PDA. Para eso, necesitará utilizar **invoke_signed** .

### CPI con **invoke_signed**
Usar **invoke_signed** es un poco diferente solo porque hay un campo adicional que requiere las semillas utilizadas para derivar cualquier PDA que debe firmar la transacción. Es posible que recuerde de lecciones anteriores que las PDA no están en la curva Ed25519 y, por lo tanto, no tienen una clave privada correspondiente. Se le ha dicho que los programas pueden proporcionar firmas para sus PDA, pero no ha aprendido cómo sucede eso hasta ahora. Los programas proporcionan firmas para sus PDA con la función** invoke_signed** . Los primeros dos campos de **invoke_signed** son los mismos que **invoke** , pero hay un campo adicional **signers_seeds** que entra en juego aquí.

```rust
invoke_signed(
    &instruction,
    accounts,
    &[&["First addresses seed"],
        &["Second addresses first seed",
        "Second addresses second seed"]],
)?;
```

Aunque las PDA no tienen sus propias claves privadas, pueden ser utilizadas por un programa para emitir una instrucción que incluya la PDA como firmante. La única manera de que el tiempo de ejecución verifique que la PDA pertenece al programa llamado es que el programa llamado proporcione las semillas utilizadas para generar la dirección en el campo **signers_seeds**.

El tiempo de ejecución Solana llamará internamente a **create_program_address** utilizando las semillas proporcionadas y el **program_id** del programa llamado. Luego puede comparar el resultado con las direcciones suministradas en la instrucción. Si alguna de las direcciones coincide, entonces el tiempo de ejecución sabe que de hecho el programa asociado con esta dirección es el llamador y, por lo tanto, está autorizado a ser un firmante.

## Mejores Prácticas y Trampas Comunes

### Comprobaciones de seguridad
Hay algunos errores comunes y cosas que recordar al utilizar CPIs que son importantes para la seguridad y robustez de su programa. Lo primero que hay que recordar es que, como sabemos ahora, no tenemos control sobre la información que se nos pasa. Por esta razón, es importante verificar siempre el **program_id** , las cuentas y los datos pasados a la CPI. Sin estas comprobaciones de seguridad, alguien podría enviar una transacción que invoque una instrucción en un programa completamente diferente al esperado, lo cual no es ideal.

Afortunadamente, hay comprobaciones inherentes en la validez de cualquier PDA que se marca como firmantes dentro de la función **invoke_signed**. Todas las demás cuentas e **instruction_data** deben ser verificadas en algún lugar de su código de programa antes de hacer la CPI. También es importante asegurarse de apuntar a la instrucción prevista en el programa que se está invocando. La manera más fácil de hacerlo es leer el código fuente del programa que se invocará, tal como lo haría si estuviera construyendo una instrucción desde el lado del cliente.

### Errores comunes
Puede haber algunos errores comunes que pueda recibir al ejecutar una CPI, generalmente significa que está construyendo la CPI con información incorrecta. Por ejemplo, puede encontrar un mensaje de error similar a este:

```
EF1M4SPfKcchb6scq297y8FPCaLvj5kGjwMzjTM68wjA's signer privilege escalated
Program returned error: "Cross-program invocation with unauthorized signer or writable account"
```

Este mensaje es un poco engañoso, porque "el privilegio de firmante se ha elevado" no parece ser un problema, pero en realidad significa que está firmando incorrectamente para la dirección en el mensaje. Si está utilizando **invoke_signed** y recibe este error, probablemente significa que las semillas que proporciona son incorrectas. Un ejemplo de transacción que falló con este error se puede encontrar aquí.

Otro error similar se produce cuando una cuenta a la que se escribe no está marcada como **escribible** dentro del struct **AccountMeta**.

```
2qoeXa9fo8xVHzd2h9mVcueh6oK3zmAiJxCTySM5rbLZ's writable privilege escalated
Program returned error: "Cross-program invocation with unauthorized signer or writable account"
```

Recuerde, cualquier cuenta cuyos datos puedan ser modificados por el programa durante la ejecución debe especificarse como escribible. Durante la ejecución, escribir en una cuenta que no se especificó como escribible causará que la transacción falle. Escribir en una cuenta que no es propiedad del programa causará que la transacción falle. Cualquier cuenta cuyo equilibrio de lamport pueda ser modificado por el programa durante la ejecución debe especificarse como escribible. Durante la ejecución, la modificación de los lamports de una cuenta que no se especificó como escribible causará que la transacción falle. Mientras se restan lamports de una cuenta que no es propiedad del programa causará que la transacción falle, agregar lamports a cualquier cuenta está permitido, siempre y cuando sea modificable.

Para ver esto en acción, vea esta [transacción en el explorador](https://explorer.solana.com/tx/ExB9YQJiSzTZDBqx4itPaa4TpT8VK4Adk7GU5pSoGEzNz9fa7PPZsUxssHGrBbJRnCvhoKgLCWnAycFB7VYDbBg?cluster=devnet).

## ¿Por qué importan los CPIs?
CPIs son una característica muy importante del ecosistema Solana y hacen que todos los programas implementados sean interoperables entre sí. Con CPIs, no hay necesidad de volver a inventar la rueda en cuanto a desarrollo. Esto crea la oportunidad de construir nuevos protocolos y aplicaciones sobre lo que ya se ha construido, como bloques de construcción o piezas de Lego. Es importante recordar que las CPIs son una relación bidireccional y lo mismo es cierto para cualquier programa que despliegue. Si construye algo interesante y útil, los desarrolladores tienen la capacidad de construir sobre lo que ha hecho o simplemente conectar su protocolo a lo que estén construyendo. La composición es una gran parte de lo que hace que las criptomonedas sean tan únicas y las CPIs son lo que lo hace posible en Solana.

Otro aspecto importante de las CPIs es que permiten a los programas firmar para sus PDAs. Como probablemente hayas notado hasta ahora, las PDAs se utilizan con mucha frecuencia en el desarrollo de Solana, ya que permiten que los programas controlen direcciones específicas de tal manera que ningún usuario externo pueda generar transacciones con firmas válidas para esas direcciones. Esto puede ser muy útil para muchas aplicaciones en Web3 (por ejemplo, DeFi, NFT, etc.). Sin CPIs, las PDAs no serían tan útiles, ya que no habría manera de que un programa firmara transacciones que involucren a ellos, convirtiéndolos esencialmente en agujeros negros (¡una vez que algo se envía a una PDA, no habría manera de sacarlo sin CPIs!)

# Demostración
Ahora vamos a obtener algunas experiencias prácticas con los CPIs haciendo algunas adiciones al programa de reseñas de películas nuevamente. Si está ingresando a esta lección sin haber pasado por las lecciones anteriores, el programa de reseñas de películas permite a los usuarios enviar reseñas de películas y almacenarlas en cuentas PDA.
En la lección anterior, agregamos la capacidad de dejar comentarios en otras reseñas de películas utilizando PDAs. En esta lección, vamos a trabajar en tener el programa acuñar fichas al revisor o comentarista cada vez que se envía una revisión o comentario.

Para implementar esto, tendremos que invocar la instrucción **MintTo** del programa SPL Token usando un CPI. Si necesita repasar los tokens, las acuñaciones de tokens y la acuñación de nuevos tokens, eche un vistazo a la [lección del programa de tokens](https://soldev.app/course/token-program.md) antes de continuar con esta demostración.

## 1. Obtener código inicial y agregar dependencias
Para comenzar, utilizaremos el estado final del programa de reseñas de películas de la lección PDA anterior. Entonces, si acabas de completar esa lección, estás listo para comenzar. Si acabas de ingresar aquí, no te preocupes, puedes descargar el código inicial [aquí](https://github.com/Unboxed-Software/solana-movie-program/tree/solution-add-comments) . Utilizaremos la rama **solution-add-comments** como punto de partida.

## 2. Agregar dependencias a **Cargo.toml**
Antes de comenzar, necesitamos agregar dos nuevas dependencias al archivo **Cargo.toml** debajo de **[dependencias]** . Utilizaremos las cajas **spl-token** y **spl-associated-token-account** además de las dependencias existentes.

```
spl-token = { version="~3.2.0", features = [ "no-entrypoint" ] }
spl-associated-token-account = { version="=1.0.5", features = [ "no-entrypoint" ] }
```

Después de agregar lo anterior, ejecuta **cargo check** en tu consola para que cargo resuelva tus dependencias y asegúrate de estar listo para continuar. Dependiendo de tu configuración, es posible que debas modificar las versiones de las cajas antes de continuar.

## 3. Agregar cuentas necesarias a **add_movie_review**
Debido a que queremos que los usuarios sean acuñados fichas al crear una reseña, tiene sentido agregar lógica de acuñación dentro de la función **add_movie_review** . Ya que vamos a acuñar fichas, la instrucción **add_movie_review** requiere algunas nuevas cuentas para ser pasadas:

- **token_mint**: la dirección de la acuñación del token
- **mint_auth** : dirección de la autoridad de la acuñación del token
- **user_ata** : cuenta de token asociada del usuario para esta acuñación (donde se acuñarán las fichas)
- **token_program** : dirección del programa de tokens

Empezaremos agregando estas nuevas cuentas a la parte de la función que itera a través de las cuentas pasadas:
    
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

No se requiere información adicional de **instruction_data** para la nueva funcionalidad, por lo que no se necesitan hacer cambios en la deserialización de los datos. La única información adicional que se necesita son las cuentas adicionales.

## 4. Acuñar fichas al revisor en **add_movie_review**

Antes de entrar en la lógica de acuñación, importemos la dirección del programa de tokens y la constante **LAMPORTS_PER_SOL** en la parte superior del archivo

```rust
// Inside processor.rs
use solana_program::native_token::LAMPORTS_PER_SOL;
use spl_associated_token_account::get_associated_token_address;
use spl_token::{instruction::initialize_mint, ID as TOKEN_PROGRAM_ID};
```

Ahora podemos pasar a la lógica que maneja la creación real de los tokens. Añadiremos esto al final de la función **add_movie_review** justo antes de devolver **Ok(())**.

La creación de tokens requiere una firma por parte de la autoridad de creación. Dado que el programa necesita poder crear tokens, la autoridad de creación debe ser una cuenta que el programa pueda firmar. En otras palabras, necesita ser una cuenta PDA propiedad del programa.

También estructuraremos nuestra creación de tokens de manera que la cuenta de creación sea una cuenta PDA que podamos derivar de manera determinista. De esta manera, siempre podremos verificar que la cuenta **token_mint** pasada al programa es la cuenta esperada.

Vamos a derivar las direcciones de la cuenta de creación de tokens y de la autoridad de creación utilizando la función **find_program_address** con las semillas "token_mint" y "token_auth", respectivamente.

```rust
// Mint tokens here
msg!("deriving mint authority");
let (mint_pda, mint_bump) = Pubkey::find_program_address(&[b"token_mint"], program_id);
let (mint_auth_pda, _mint_auth_bump) = Pubkey::find_program_address(&[b"token_auth"], program_id);
```

A continuación, realizaremos comprobaciones de seguridad en cada una de las nuevas cuentas pasadas al programa. ¡Recuerda siempre verificar las cuentas!

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

Finalmente, podemos emitir una CPI a la función **mint_to** del programa de token con las cuentas correctas utilizando **invoke_signed** . La caja **spl_token** proporciona una función de ayuda **mint_to** para crear la instrucción de acuñación. Esto es genial porque significa que no tenemos que construir manualmente toda la instrucción desde cero. Más bien, simplemente podemos pasar los argumentos requeridos por la función. Esta es la firma de la función:

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

Luego proporcionamos copias de las cuentas **token_mint** , **user_ata** y **mint_auth** . Y, lo más relevante para esta lección, proporcionamos las semillas utilizadas para encontrar la dirección **token_mint** , incluyendo la semilla de bump.

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

Tenga en cuenta que estamos utilizando **invoke_signed** y no **invoke** aquí. El programa Token requiere que la cuenta **mint_auth** firme esta transacción. Dado que la cuenta **mint_auth** es un PDA, solo el programa del cual se derivó puede firmar en su nombre. Cuando se llama a **invoke_signed** , el tiempo de ejecución de Solana llama a **create_program_address** con las semillas y el bump proporcionados y luego compara la dirección derivada con todas las direcciones de los objetos **AccountInfo** proporcionados. Si alguna de las direcciones coincide con la dirección derivada, el tiempo de ejecución sabe que la cuenta coincidente es un PDA de este programa y que el programa está firmando esta transacción para esta cuenta. 

En este punto, la instrucción **add_movie_review** debería ser completamente funcional y acuñará diez tokens para el revisor cuando se cree una reseña.

## 5. Repetir para **add_comment**

Nuestras actualizaciones para la función **add_comment** serán casi idénticas a lo que hicimos para la función **add_movie_review** anterior. La única diferencia es que cambiaremos la cantidad de tokens acuñados para un comentario de diez a cinco para que agregar reseñas tenga un peso superior al comentar. Primero, actualice las cuentas con las mismas cuatro cuentas adicionales como en la función **add_movie_review** .

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

A continuación, vaya al final de la función **add_comment** justo antes de **Ok(())** . Luego derive las cuentas de acuñación de token y autoridad de acuñación. Recuerda, ambas son PDAs derivadas de las semillas "token_mint" y "token_authority" respectivamente.

```rust
// Mint tokens here
msg!("deriving mint authority");
let (mint_pda, mint_bump) = Pubkey::find_program_address(&[b"token_mint"], program_id);
let (mint_auth_pda, _mint_auth_bump) =
    Pubkey::find_program_address(&[b"token_auth"], program_id);
```

Después, verifique que cada una de las nuevas cuentas sea la cuenta correcta.

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

Finalmente, utilice **invoke_signed** para enviar la instrucción **mint_to** al programa Token, enviando cinco tokens al comentarista.

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

## 6. Configurar la acuñación de tokens
Hemos escrito todo el código necesario para acuñar tokens a los revisores y comentaristas, pero todo asume que hay una acuñación de tokens en el PDA derivado con la semilla "token_mint". Para que esto funcione, vamos a configurar una instrucción adicional para inicializar la acuñación de tokens. Se escribirá de tal manera que solo se pueda llamar una vez y no importa especialmente quién lo llame.

Dado que a lo largo de esta lección ya hemos trabajado en todos los conceptos asociados con PDAs y CPIs varias veces, vamos a pasar por esta parte con menos explicación que los pasos anteriores. Comience agregando un cuarto variante de instrucción al enum **MovieInstruction** en **instruction.rs** .

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

Asegúrese de agregarlo a la declaración **match** en la función **unpack** en el mismo archivo debajo de la variante **3**.

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

En la función **process_instruction** en el archivo **processor.rs** , agregue la nueva instrucción a la declaración **match** y llame a una función **initialize_token_mint**.

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

Finalmente, declare e implemente la función **initialize_token_mint** . Esta función derivará las PDAs de acuñación de token y autoridad de acuñación, creará la cuenta de acuñación de token y luego inicializará la acuñación de token. No explicaremos todo esto en detalle, pero vale la pena leer el código, especialmente dado que la creación e inicialización de la acuñación de tokens ambas involucran CPIs. De nuevo, si necesita un recordatorio sobre tokens y acuñaciones, eche un vistazo a la [lección del programa Token](https://soldev.app/course/token-program.md).

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

## 7. Construir y desplegar
¡Ahora estamos listos para construir y desplegar nuestro programa! Puede construir el programa ejecutando **cargo build-bpf** y luego ejecutando el comando que se devuelve, debería verse algo así como **solana program deploy <PATH>** .
Antes de poder comenzar a probar si agregar una reseña o comentario te envía tokens, necesita inicializar la acuñación de tokens del programa. Puede usar [este script](https://github.com/Unboxed-Software/solana-movie-token-client) para hacerlo. Una vez que hayas clonado ese repositorio, reemplaza el **PROGRAM_ID** en **index.ts** con el ID de tu programa. Luego ejecuta **npm install** y luego **npm start** . El script asume que estás desplegando en Devnet. Si estás desplegando localmente, asegúrate de adaptar el script en consecuencia.
Una vez que hayas inicializado tu acuñación de tokens, puedes usar el frontend de [Movie Review](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-add-tokens) para probar agregar reseñas y comentarios. De nuevo, el código asume que estás en Devnet, así que por favor actúa en consecuencia.
Después de enviar una reseña, ¡deberías ver 10 nuevos tokens en tu billetera! Cuando agregues un comentario, deberías recibir 5 tokens. No tendrán un nombre o imagen elegante ya que no agregamos ningún metadato al token, pero tienes la idea.
Si necesitas más tiempo con los conceptos de esta lección o te atascaste en el camino, no dudes en [echar un vistazo al código de solución](https://github.com/Unboxed-Software/solana-movie-program/tree/solution-add-tokens) . Tenga en cuenta que la solución a esta demostración está en la rama **solution-add-tokens** .

# Desafío 
Para aplicar lo que has aprendido sobre CPIs en esta lección, piénsa en cómo podrías incorporarlos en el programa Student Intro. Podrías hacer algo similar a lo que hicimos en la demostración aquí y agregar alguna funcionalidad para acuñar tokens a los usuarios cuando se presentan. O si te sientes realmente ambicioso, piénsa en cómo podrías tomar todo lo que has aprendido hasta ahora en el curso y crear algo completamente nuevo desde cero.
Un gran ejemplo sería construir un Stack Overflow descentralizado. El programa podría utilizar tokens para determinar la calificación general de un usuario, acuñar tokens cuando se responden preguntas correctamente, permitir a los usuarios votar respuestas, etc. ¡Todo eso es posible y ahora tienes las habilidades y el conocimiento para ir y construir algo así por tu cuenta!
¡Felicidades por llegar al final del Módulo 4! No dudes en compartir alguna retroalimentación rápida [aquí](https://airtable.com/shrOsyopqYlzvmXSC?prefill_Module=Module%204), para que podamos seguir mejorando el curso.
