# Canonicalización de la semilla de Bump

## Objetivos de la lección

- Explicar las vulnerabilidades asociadas con el uso de PDAs derivadas sin el bump canónico
- Inicializar una PDA utilizando las **seeds** y las restricciones de **Bump** de Anchor para utilizar automáticamente el bump canónico
- Usar las **seeds** y las restricciones de **Bump** de Anchor para garantizar que siempre se utilice el bump canónico en las instrucciones futuras al derivar una PDA.

# Terminología

- La función [create_program_address](https://docs.rs/solana-program/latest/solana_program/pubkey/struct.Pubkey.html#method.create_program_address) deriva una PDA sin buscar el **bump canónico** . Esto significa que hay múltiples bumps válidos, todos los cuales producirán direcciones diferentes.
- Usando [find_program_address](https://docs.rs/solana-program/latest/solana_program/pubkey/struct.Pubkey.html#method.find_program_address) garantiza que se utilice el bump válido más alto, o el bump canónico, para la derivación, creando así una forma determinística de encontrar una dirección dada semillas específicas.
- Al inicializar, puedes usar las **seeds** y las **bump** de restricciones de Anchor para garantizar que las derivaciones de PDA en la estructura de validación de cuentas siempre utilicen el bump canónico.
- Anchor te permite **especificar un bump** con la restricción **bump = <some_bump>** cuando se verifica la dirección de una PDA.
- Debido a que **find_program_address** puede ser costoso, la mejor práctica es almacenar el bump derivado en un campo de datos de una cuenta para ser referenciado más tarde al volver a derivar la dirección para la verificación.

```Rust
#[derive(Accounts)]
pub struct VerifyAddress<'info> {
	#[account(
    	seeds = [DATA_PDA_SEED.as_bytes()],
	    bump = data.bump
	)]
	data: Account<'info, Data>,
}
```

# Resumen

Las semillas de bump son un número entre 0 y 255, incluyendo, utilizado para asegurar que una dirección derivada utilizando [create_program_address](https://docs.rs/solana-program/latest/solana_program/pubkey/struct.Pubkey.html#method.create_program_address) es una PDA válida. El **bump canónico** es el valor de bump más alto que produce una PDA válida. El estándar en Solana es siempre utilizar el bump canónico al derivar PDAs, tanto por seguridad como por comodidad.

## Derivación insegura de PDA utilizando **create_program_address**

Dado un conjunto de semillas, la función **create_program_address** producirá una PDA válida aproximadamente el 50% del tiempo. La semilla de bump es un byte adicional agregado como semilla para "dar un golpe" a la dirección derivada en territorio válido. Dado que hay 256 semillas de bump posibles y la función produce PDAs válidas aproximadamente el 50% del tiempo, hay muchos bumps válidos para un conjunto dado de semillas de entrada.

Se puede imaginar que esto podría causar confusión para localizar cuentas al utilizar semillas como una forma de mapeo entre información conocida y cuentas. Utilizar el bump canónico como estándar garantiza que siempre se puede encontrar la cuenta correcta. Lo más importante, evita las explotaciones de seguridad causadas por la naturaleza abierta de permitir múltiples bumps.

En el ejemplo que se muestra a continuación, la instrucción **set_value** utiliza un **bump** que se pasó como datos de instrucción para derivar una PDA. Luego, la instrucción deriva la PDA utilizando la función **create_program_address** y verifica que la **address** coincida con la clave pública de la cuenta **data** .

```Rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod bump_seed_canonicalization_insecure {
    use super::*;

    pub fn set_value(ctx: Context<BumpSeed>, key: u64, new_value: u64, bump: u8) -> Result<()> {
        let address =
            Pubkey::create_program_address(&[key.to_le_bytes().as_ref(), &[bump]], ctx.program_id).unwrap();
        if address != ctx.accounts.data.key() {
            return Err(ProgramError::InvalidArgument.into());
        }

        ctx.accounts.data.value = new_value;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct BumpSeed<'info> {
    data: Account<'info, Data>,
}

#[account]
pub struct Data {
    value: u64,
}
```

Aunque la instrucción deriva la PDA y verifica la cuenta pasada, lo cual es bueno, permite al llamador pasar un bump arbitrario. Dependiendo del contexto de su programa, esto podría resultar en un comportamiento no deseado o una posible explotación.

Si el mapeo de semillas se suponía para imponer una relación uno a uno entre PDA y usuario, por ejemplo, este programa no cumpliría adecuadamente con eso. Un usuario podría llamar al programa varias veces con muchos bumps válidos, cada uno produciendo una PDA diferente.

## Derivación recomendada utilizando **find_program_address**

Una forma sencilla de solucionar este problema es que el programa espere solo el bump canónico y utilice [find_program_address](https://docs.rs/solana-program/latest/solana_program/pubkey/struct.Pubkey.html#method.find_program_address) para derivar la PDA.

La función **find_program_address** siempre utiliza el bump canónico. Esta función itera llamando a **create_program_address** , comenzando con un bump de 255 y decrementando el bump en uno en cada iteración. Tan pronto como se encuentra una dirección válida, la función devuelve tanto la PDA derivada como el bump canónico utilizado para derivarla.

Esto garantiza un mapeo uno a uno entre sus semillas de entrada y la dirección que producen.

```Rust
pub fn set_value_secure(
    ctx: Context<BumpSeed>,
    key: u64,
    new_value: u64,
    bump: u8,
) -> Result<()> {
    let (address, expected_bump) =
        Pubkey::find_program_address(&[key.to_le_bytes().as_ref()], ctx.program_id);

    if address != ctx.accounts.data.key() {
        return Err(ProgramError::InvalidArgument.into());
    }
    if expected_bump != bump {
        return Err(ProgramError::InvalidArgument.into());
    }

    ctx.accounts.data.value = new_value;
    Ok(())
}
```

## Usar las **seeds** y restricciones de **bump** de Anchor

Anchor proporciona una forma conveniente de derivar PDAs en la estructura de validación de cuentas utilizando las **seeds** y restricciones de **bump** . Incluso se pueden combinar con la restricción de **init** para inicializar la cuenta en la dirección prevista. Para proteger el programa de la vulnerabilidad que hemos estado discutiendo a lo largo de esta lección, Anchor ni siquiera te permite inicializar una cuenta en una PDA utilizando cualquier cosa que no sea el bump canónico. En su lugar, utiliza **find_program_address** para derivar la PDA y, posteriormente, realiza la inicialización.

```Rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod bump_seed_canonicalization_recommended {
    use super::*;

    pub fn set_value(ctx: Context<BumpSeed>, _key: u64, new_value: u64) -> Result<()> {
        ctx.accounts.data.value = new_value;
        Ok(())
    }
}

// initialize account at PDA
#[derive(Accounts)]
#[instruction(key: u64)]
pub struct BumpSeed<'info> {
  #[account(mut)]
  payer: Signer<'info>,
  #[account(
    init,
    seeds = [key.to_le_bytes().as_ref()],
    // derives the PDA using the canonical bump
    bump,
    payer = payer,
    space = 8 + 8
  )]
  data: Account<'info, Data>,
  system_program: Program<'info, System>
}

#[account]
pub struct Data {
    value: u64,
}
```

Si no estás inicializando una cuenta, todavía puedes validar PDAs con las **seeds** y restricciones de **bump** . Esto simplemente vuelve a derivar la PDA y compara la dirección derivada con la dirección de la cuenta pasada.

En este escenario, Anchor sí permite especificar el bump para utilizar para derivar la PDA con **bump = <some_bump>** . La intención aquí no es que utilice bumps arbitrarios, sino que le permite optimizar su programa. La naturaleza iterativa de **find_program_address** lo hace costoso, por lo que la mejor práctica es almacenar el bump canónico en el campo de datos de la cuenta PDA al inicializar una PDA, lo que le permite hacer referencia al bump almacenado al validar la PDA en instrucciones posteriores.

Cuando específicas el bump a utilizar, Anchor utiliza **create_program_address** con el bump proporcionado en lugar de **find_program_address** . Este patrón de almacenar el bump en los datos de la cuenta asegura que su programa siempre utiliza el bump canónico sin deteriorar el rendimiento.

```Rust
use anchor_lang::prelude::*;

declare_id!("CVwV9RoebTbmzsGg1uqU1s4a3LvTKseewZKmaNLSxTqc");

#[program]
pub mod bump_seed_canonicalization_recommended {
    use super::*;

    pub fn set_value(ctx: Context<BumpSeed>, _key: u64, new_value: u64) -> Result<()> {
        ctx.accounts.data.value = new_value;
        // store the bump on the account
        ctx.accounts.data.bump = *ctx.bumps.get("data").unwrap();
        Ok(())
    }

    pub fn verify_address(ctx: Context<VerifyAddress>, _key: u64) -> Result<()> {
        msg!("PDA confirmed to be derived with canonical bump: {}", ctx.accounts.data.key());
        Ok(())
    }
}

// initialize account at PDA
#[derive(Accounts)]
#[instruction(key: u64)]
pub struct BumpSeed<'info> {
  #[account(mut)]
  payer: Signer<'info>,
  #[account(
    init,
    seeds = [key.to_le_bytes().as_ref()],
    // derives the PDA using the canonical bump
    bump,
    payer = payer,
    space = 8 + 8 + 1
  )]
  data: Account<'info, Data>,
  system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(key: u64)]
pub struct VerifyAddress<'info> {
  #[account(
    seeds = [key.to_le_bytes().as_ref()],
    // guranteed to be the canonical bump every time
    bump = data.bump
  )]
  data: Account<'info, Data>,
}

#[account]
pub struct Data {
    value: u64,
    // bump field
    bump: u8
}
```

Si no especifica el bump en la restricción de **bump** , Anchor todavía utilizará **find_program_address** para derivar la PDA utilizando el bump canónico. Como consecuencia, su instrucción incurrirá en una cantidad variable de presupuesto de cálculo. Los programas que ya corren el riesgo de superar su presupuesto de cálculo deben usar esto con cuidado, ya que existe la posibilidad de que el presupuesto del programa pueda ser superado ocasional e impredeciblemente.

Por otro lado, si solo necesita verificar la dirección de una PDA pasada sin inicializar una cuenta, se le obligará a permitir que Anchor derive el bump canónico o a exponer su programa a riesgos innecesarios. En ese caso, utilice el bump canónico a pesar del pequeño impacto en el rendimiento.

# Demostración

Para demostrar las explotaciones de seguridad posibles cuando no se verifica el bump canónico, trabajemos con un programa que permite a cada usuario del programa "reclamar" recompensas en el tiempo.

## 1. Configuración

Comience obteniendo el código en la rama **starter** de este [repositorio](https://github.com/Unboxed-Software/solana-bump-seed-canonicalization/tree/starter).

Observe que hay dos instrucciones en el programa y una sola prueba en el directorio de **tests**.

Las instrucciones en el programa son:

1. **create_user_insecure**
2. **claim_insecure**

La instrucción **create_user_insecure** simplemente crea una nueva cuenta en una PDA derivada utilizando la clave pública del firmante y un bump pasado.

La instrucción **claim_insecure** emite 10 tokens al usuario y luego marca las recompensas de la cuenta como reclamadas para que no puedan reclamarlas de nuevo.

Sin embargo, el programa no verifica explícitamente que las PDAs en cuestión estén utilizando el bump canónico.

Echa un vistazo al programa para entender lo que hace antes de continuar.

## 2. Test de instrucciones inseguras

Dado que las instrucciones no exigen explícitamente que la PDA del **user** utilice el bump canónico, un atacante puede crear varias cuentas por billetera y reclamar más recompensas de las permitidas.

La prueba en el directorio de **tests** crea un nuevo par de claves llamado **attacker** para representar a un atacante. Luego, recorre todos los bumps posibles y llama a **create_user_insecure** y **claim_insecure** . Al final, la prueba espera que el atacante haya podido reclamar recompensas varias veces y haya ganado más de los 10 tokens por usuario.

```Rust
it("Attacker can claim more than reward limit with insecure instructions", async () => {
    const attacker = Keypair.generate()
    await safeAirdrop(attacker.publicKey, provider.connection)
    const ataKey = await getAssociatedTokenAddress(mint, attacker.publicKey)

    let numClaims = 0

    for (let i = 0; i < 256; i++) {
      try {
        const pda = createProgramAddressSync(
          [attacker.publicKey.toBuffer(), Buffer.from([i])],
          program.programId
        )
        await program.methods
          .createUserInsecure(i)
          .accounts({
            user: pda,
            payer: attacker.publicKey,
          })
          .signers([attacker])
          .rpc()
        await program.methods
          .claimInsecure(i)
          .accounts({
            user: pda,
            mint,
            payer: attacker.publicKey,
            userAta: ataKey,
          })
          .signers([attacker])
          .rpc()

        numClaims += 1
      } catch (error) {
        if (
          error.message !== "Invalid seeds, address must fall off the curve"
        ) {
          console.log(error)
        }
      }
    }

    const ata = await getAccount(provider.connection, ataKey)

    console.log(
      `Attacker claimed ${numClaims} times and got ${Number(ata.amount)} tokens`
    )

    expect(numClaims).to.be.greaterThan(1)
    expect(Number(ata.amount)).to.be.greaterThan(10)
})
```

Ejecuta el comando **anchor test** para ver que esta prueba pasa, lo que demuestra que el atacante tiene éxito. Dado que la prueba llama a las instrucciones para cada bump válido, tarda un poco en ejecutarse, así que ten paciencia.

```Rust
bump-seed-canonicalization
Attacker claimed 129 times and got 1290 tokens
    ✔ Attacker can claim more than reward limit with insecure instructions (133840ms)
```

## 3. Crear instrucciones seguras

Vamos a demostrar cómo solucionar la vulnerabilidad creando dos nuevas instrucciones:

1. **create_user_secure**
1. **claim_secure**

Antes de escribir la lógica de validación de cuentas o instrucciones, creemos un nuevo tipo de usuario, **UserSecure** . Este nuevo tipo agrega el bump canónico como un campo en la estructura.

```Rust
#[account]
pub struct UserSecure {
    auth: Pubkey,
    bump: u8,
    rewards_claimed: bool,
}
```

A continuación, crearemos estructuras de validación de cuentas para cada una de las nuevas instrucciones. Serán muy similares a las versiones inseguras, pero permitirán que Anchor maneje la derivación y deserialización de las PDAs.

```Rust
#[derive(Accounts)]
pub struct CreateUserSecure<'info> {
    #[account(mut)]
    payer: Signer<'info>,
    #[account(
        init,
        seeds = [payer.key().as_ref()],
        // derives the PDA using the canonical bump
        bump,
        payer = payer,
        space = 8 + 32 + 1 + 1
    )]
    user: Account<'info, UserSecure>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SecureClaim<'info> {
    #[account(
        seeds = [payer.key().as_ref()],
        bump = user.bump,
        constraint = !user.rewards_claimed @ ClaimError::AlreadyClaimed,
        constraint = user.auth == payer.key()
    )]
    user: Account<'info, UserSecure>,
    #[account(mut)]
    payer: Signer<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer
    )]
    user_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    mint: Account<'info, Mint>,
    /// CHECK: mint auth PDA
    #[account(seeds = ["mint".as_bytes().as_ref()], bump)]
    pub mint_authority: UncheckedAccount<'info>,
    token_program: Program<'info, Token>,
    associated_token_program: Program<'info, AssociatedToken>,
    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>,
}
```

Por último, implementemos la lógica de la instrucción para las dos nuevas instrucciones. La instrucción **create_user_secure** solo necesita establecer los campos **auth** , **bump** y **rewards_claimed** en los datos de la cuenta de **user**.

```Rust
pub fn create_user_secure(ctx: Context<CreateUserSecure>) -> Result<()> {
    ctx.accounts.user.auth = ctx.accounts.payer.key();
    ctx.accounts.user.bump = *ctx.bumps.get("user").unwrap();
    ctx.accounts.user.rewards_claimed = false;
    Ok(())
}
```

La instrucción **claim_secure** necesita acuñar 10 tokens para el **user** y establecer el campo **rewards_claimed** de la cuenta del usuario en **true** .

```Rust
pub fn claim_secure(ctx: Context<SecureClaim>) -> Result<()> {
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.user_ata.to_account_info(),
                authority: ctx.accounts.mint_authority.to_account_info(),
            },
            &[&[
                    b"mint".as_ref(),
                &[*ctx.bumps.get("mint_authority").unwrap()],
            ]],
        ),
        10,
    )?;

    ctx.accounts.user.rewards_claimed = true;

    Ok(())
}
```

## 4. Test de instrucciones seguras

Ahora vamos a escribir una prueba para mostrar que el atacante ya no puede reclamar la recompensa más de una vez utilizando las nuevas instrucciones.

Observa que si comienzas a recorrer mediante varios PDAs como la antigua prueba, ni siquiera puedes pasar el bump no canónico a las instrucciones. Sin embargo, todavía puedes recorrer varios PDAs y al final comprobar que solo se realizó una reclamación para un total de 10 tokens. Tu prueba final se verá algo así:

```Rust
it.only("Attacker can only claim once with secure instructions", async () => {
    const attacker = Keypair.generate()
    await safeAirdrop(attacker.publicKey, provider.connection)
    const ataKey = await getAssociatedTokenAddress(mint, attacker.publicKey)
    const [userPDA] = findProgramAddressSync(
      [attacker.publicKey.toBuffer()],
      program.programId
    )

    await program.methods
      .createUserSecure()
      .accounts({
        payer: attacker.publicKey,
      })
      .signers([attacker])
      .rpc()

    await program.methods
      .claimSecure()
      .accounts({
        payer: attacker.publicKey,
        userAta: ataKey,
        mint,
        user: userPDA,
      })
      .signers([attacker])
      .rpc()

    let numClaims = 1

    for (let i = 0; i < 256; i++) {
      try {
        const pda = createProgramAddressSync(
          [attacker.publicKey.toBuffer(), Buffer.from([i])],
          program.programId
        )
        await program.methods
          .createUserSecure()
          .accounts({
            user: pda,
            payer: attacker.publicKey,
          })
          .signers([attacker])
          .rpc()

        await program.methods
          .claimSecure()
          .accounts({
            payer: attacker.publicKey,
            userAta: ataKey,
            mint,
            user: pda,
          })
          .signers([attacker])
          .rpc()

        numClaims += 1
      } catch {}
    }

    const ata = await getAccount(provider.connection, ataKey)

    expect(Number(ata.amount)).to.equal(10)
    expect(numClaims).to.equal(1)
})
```

```Rust
bump-seed-canonicalization
Attacker claimed 119 times and got 1190 tokens
    ✔ Attacker can claim more than reward limit with insecure instructions (128493ms)
    ✔ Attacker can only claim once with secure instructions (1448ms)
```

Si utilizas Anchor para todas las derivaciones de PDA, este exploit en particular es bastante fácil de evitar. Sin embargo, si terminas haciendo algo "no estándar", ten cuidado de diseñar tu programa para utilizar explícitamente el bump canónico.

Si quieres ver el código de solución final, puedes encontrarlo en la rama de **solution** del mismo [repositorio](https://github.com/Unboxed-Software/solana-bump-seed-canonicalization/tree/solution).

# Reto

Como con otras lecciones en este módulo, tu oportunidad de practicar evitando este exploit de seguridad radica en revisar tus propios programas o de otros.

Tómate un tiempo para revisar al menos un programa y asegurarte de que todas las derivaciones y verificaciones de PDA estén utilizando el bump canónico.

Recuerda, si encuentras un error o exploit en el programa de alguien más, ¡notifícalo! Si lo encuentras en tu propio programa, asegúrate de corregirlo de inmediato.
