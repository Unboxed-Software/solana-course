# Comprobación de propietario

## Objetivos de la lección

_Para el final de esta lección podrás:_

- Explicar los riesgos de seguridad asociados con no realizar los controles apropiados del propietario
- Implementar verificaciones de propietario usando Rust de formato largo (long-form)
- Usar el envoltorio **Anchor´s Account<'info, T>** y un tipo de cuenta para automatizar las comprobaciones del propietario
- Use la restricción **#[account(propietario = <expr>)]** de Anchor para definir explícitamente un programa externo que debe poseer una cuenta.

# Terminología

- Usar la **comprobación de propietario** para verificar que las cuentas son propiedad del programa esperado. Sin las comprobaciones de propietario adecuadas, las cuentas de propiedad de programas inesperados podrían ser utilizadas en una instrucción.
- Para implementar una comprobación de propietario en Rust, simplemente verifique que el propietario de una cuenta coincida con un ID de programa esperado.

```Rust
if ctx.accounts.account.owner != ctx.program_id {
    return Err(ProgramError::IncorrectProgramId.into());
}
```

- En Anchor, los tipos de cuentas de programas implementan el trait **Owner**, lo que permite al envoltorio **Account<'info, T>** verificar automáticamente la propiedad del programa.
- Anchor le da la opción de definir explícitamente al propietario de una cuenta si debería ser algo diferente del programa que se está ejecutando actualmente.

# Resumen

Las comprobaciones de propietario se utilizan para verificar que una cuenta pasada a una instrucción es propiedad de un programa esperado. Esto evita que las cuentas de propiedad de un programa inesperado se utilicen en una instrucción.

Como recordatorio, la estructura **AccountInfo** contiene los siguientes campos. Una comprobación de propietario se refiere a la verificación de que el campo de **owner** en **AccountInfo** coincida con un ID de programa esperado.

```Rust
/// Account information
#[derive(Clone)]
pub struct AccountInfo<'a> {
    /// Public key of the account
    pub key: &'a Pubkey,
    /// Was the transaction signed by this account's public key?
    pub is_signer: bool,
    /// Is the account writable?
    pub is_writable: bool,
    /// The lamports in the account.  Modifiable by programs.
    pub lamports: Rc<RefCell<&'a mut u64>>,
    /// The data held in this account.  Modifiable by programs.
    pub data: Rc<RefCell<&'a mut [u8]>>,
    /// Program that owns this account
    pub owner: &'a Pubkey,
    /// This account's data contains a loaded program (and is now read-only)
    pub executable: bool,
    /// The epoch at which this account will next owe rent
    pub rent_epoch: Epoch,
}
```

## Falta de comprobación de propietario

El ejemplo de abajo muestra una instrucción de administrador **admin_instruction** que debe ser accesible solo por una cuenta de **admin** almacenada en una cuenta de**admin_instruction** .

A pesar de que la instrucción verifica que la cuenta de **admin** haya firmado la transacción y coincida con el campo de **admin** almacenado en la cuenta de **admin_config** , no hay una verificación de propietario para verificar que la **admin_config** de administrador pasada a la instrucción sea propiedad del programa ejecutándose.

Dado que **admin_config** no está marcado como lo indica el tipo **AccountInfo** , se podría usar una cuenta **admin_config** falsa propiedad de un programa diferente en **admin_instruction** . Esto significa que un atacante podría crear un programa con **admin_config** cuya estructura de datos coincide con **admin_config** de su programa, establecer su clave pública como **admin** y pasar su cuenta **admin_config** a su programa. Esto les permitiría engañar efectivamente a su programa haciéndoles creer que son los administradores autorizados de su programa.

Este ejemplo simplificado solo imprime el **admin** en los registros del programa. Sin embargo, puede imaginar cómo una comprobación de propietario faltante podría permitir que cuentas falsas exploten una instrucción.

```Rust
use anchor_lang::prelude::*;

declare_id!("Cft4eTTrt4sJU4Ar35rUQHx6PSXfJju3dixmvApzhWws");

#[program]
pub mod owner_check {
    use super::*;
	...

    pub fn admin_instruction(ctx: Context<Unchecked>) -> Result<()> {
        let account_data = ctx.accounts.admin_config.try_borrow_data()?;
        let mut account_data_slice: &[u8] = &account_data;
        let account_state = AdminConfig::try_deserialize(&mut account_data_slice)?;

        if account_state.admin != ctx.accounts.admin.key() {
            return Err(ProgramError::InvalidArgument.into());
        }
        msg!("Admin: {}", account_state.admin.to_string());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Unchecked<'info> {
    admin_config: AccountInfo<'info>,
    admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

## Agregar comprobación de propietario.

En Rust original, podrías resolver este problema comparando el campo de **owner** en la cuenta con el ID del programa. Si no coinciden, arrojaría un error **IncorrectProgramId**.

```Rust
if ctx.accounts.admin_config.owner != ctx.program_id {
    return Err(ProgramError::IncorrectProgramId.into());
}
```

Agregar una comprobación de propietario evita que se pasen cuentas propiedad de un programa inesperado como la cuenta de **admin_config** . Si se usa una cuenta falsa de **admin_config** en la **admin_instruction**, entonces la transacción fallaría.

```Rust
use anchor_lang::prelude::*;

declare_id!("Cft4eTTrt4sJU4Ar35rUQHx6PSXfJju3dixmvApzhWws");

#[program]
pub mod owner_check {
    use super::*;
    ...
    pub fn admin_instruction(ctx: Context<Unchecked>) -> Result<()> {
        if ctx.accounts.admin_config.owner != ctx.program_id {
            return Err(ProgramError::IncorrectProgramId.into());
        }

        let account_data = ctx.accounts.admin_config.try_borrow_data()?;
        let mut account_data_slice: &[u8] = &account_data;
        let account_state = AdminConfig::try_deserialize(&mut account_data_slice)?;

        if account_state.admin != ctx.accounts.admin.key() {
            return Err(ProgramError::InvalidArgument.into());
        }
        msg!("Admin: {}", account_state.admin.to_string());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Unchecked<'info> {
    admin_config: AccountInfo<'info>,
    admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

## Uso de Anchor **Account<'info, T>**

Anchor puede hacer esto más simple con **Account**

El tipo de cuenta **Account<'info, T>** es un envoltorio alrededor de **AccountInfo** que verifica la propiedad del programa y deserializa los datos subyacentes en el tipo de cuenta especificado **T** . Esto a su vez te permite utilizar **Account<'info, T>** para validar fácilmente la propiedad.

Para el contexto, el atributo **#[account]** implementa varios rasgos para una estructura de datos que representa una cuenta. Uno de ellos es el rasgo de **Propietario** que define una dirección que se espera que sea propietaria de una cuenta. El propietario se establece como el ID del programa especificado en la macro **declare_id!** .
En el ejemplo de abajo, **Account<'info, AdminConfig>** es usado para validar **admin_config** . Esto realizará automáticamente la verificación del propietario y deserializará los datos de la cuenta. Además, la restricción **has_one** se usa para verificar que la cuenta de **admin** coincida con el campo de **admin** almacenado en la cuenta **admin_config** .

De esta manera, no necesita saturar su lógica de instrucción con comprobaciones de propietario.

```Rust
use anchor_lang::prelude::*;

declare_id!("Cft4eTTrt4sJU4Ar35rUQHx6PSXfJju3dixmvApzhWws");

#[program]
pub mod owner_check {
    use super::*;
	...
    pub fn admin_instruction(ctx: Context<Checked>) -> Result<()> {
        msg!("Admin: {}", ctx.accounts.admin_config.admin.to_string());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Checked<'info> {
    #[account(
        has_one = admin,
    )]
    admin_config: Account<'info, AdminConfig>,
    admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

## Usar la restricción de Anchor **#[account(owner = <expr>)]**

Además del tipo de **Account** , puede usar una restricción de **owner** . La restricción de **owner** le permite definir el programa que debe poseer una cuenta si es diferente del que se está ejecutando actualmente. Esto resulta útil si, por ejemplo, está escribiendo una instrucción que espera que una cuenta sea una PDA derivada de un programa diferente. Puede usar las restricciones **seeds** y **bump** y definir el **owner** para derivar y verificar correctamente la dirección de la cuenta que se pasó.

Para usar la restricción de **owner** , deberá tener acceso a la clave pública del programa del que espera tener una cuenta. Puede pasar el programa como una cuenta adicional o codificar la clave pública en algún lugar de su programa.

```Rust
use anchor_lang::prelude::*;

declare_id!("Cft4eTTrt4sJU4Ar35rUQHx6PSXfJju3dixmvApzhWws");

#[program]
pub mod owner_check {
    use super::*;
    ...
    pub fn admin_instruction(ctx: Context<Checked>) -> Result<()> {
        msg!("Admin: {}", ctx.accounts.admin_config.admin.to_string());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Checked<'info> {
    #[account(
        has_one = admin,
    )]
    admin_config: Account<'info, AdminConfig>,
    admin: Signer<'info>,
    #[account(
            seeds = b"test-seed",
            bump,
            owner = token_program.key()
    )]
    pda_derived_from_another_program: AccountInfo<'info>,
    token_program: Program<'info, Token>
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

# Demostración

En esta demostración, usaremos dos programas para demostrar cómo una comprobación de propietario faltante podría permitir que una cuenta falsa drene los tokens de una cuenta de "bóveda" de tokens simplificada (tenga en cuenta que esto es muy similar a la demostración de la lección Autorización del firmante).

Para ayudar a ilustrar esto, a un programa le faltará una comprobación de propietario de cuenta en la cuenta de bóveda a la que retira tokens.
El segundo programa será un clon directo del primer programa creado por un usuario malintencionado para crear una cuenta idéntica a la cuenta de bóveda del primer programa.

Sin la verificación del propietario, este usuario malintencionado podría pasar la cuenta de bóveda de propiedad de su programa "falso" y el programa original aún se ejecutará.

## 1. Comencemos

Para comenzar, descargue el código de **inicio** del [repositorio](https://github.com/Unboxed-Software/solana-owner-checks/tree/starter) . El código de inicio incluye dos programas **clone** y **owner_check** y la configuración repetitiva para el archivo de prueba.

El programa **owner_check** incluye dos instrucciones:

- **initialize_vault** inicia una cuenta de bóveda simplificada que almacena las direcciones de una cuenta de token y una cuenta de autoridad
- **insecure_withdraw** , retira tokens de la cuenta de tokens, pero falta la comprobación de propietario para la cuenta de bóveda

```Rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB");

#[program]
pub mod owner_check {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        ctx.accounts.vault.token_account = ctx.accounts.token_account.key();
        ctx.accounts.vault.authority = ctx.accounts.authority.key();
        Ok(())
    }

    pub fn insecure_withdraw(ctx: Context<InsecureWithdraw>) -> Result<()> {
        let account_data = ctx.accounts.vault.try_borrow_data()?;
        let mut account_data_slice: &[u8] = &account_data;
        let account_state = Vault::try_deserialize(&mut account_data_slice)?;

        if account_state.authority != ctx.accounts.authority.key() {
            return Err(ProgramError::InvalidArgument.into());
        }

        let amount = ctx.accounts.token_account.amount;

        let seeds = &[
            b"token".as_ref(),
            &[*ctx.bumps.get("token_account").unwrap()],
        ];
        let signer = [&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.token_account.to_account_info(),
                to: ctx.accounts.withdraw_destination.to_account_info(),
            },
            &signer,
        );

        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        payer = authority,
        token::mint = mint,
        token::authority = token_account,
        seeds = [b"token"],
        bump,
    )]
    pub token_account: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct InsecureWithdraw<'info> {
    /// CHECK:
    pub vault: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [b"token"],
        bump,
    )]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub authority: Signer<'info>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

El programa de **clone** tiene una sola instrucción

- **initialize_vault** inicia una cuenta de "bóveda" que imita la cuenta de bóveda del programa **owner_check** . Almacena la dirección de la cuenta del token de la bóveda real, pero permite que el usuario malintencionado coloque su propia cuenta de autoridad.

```Rust
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

declare_id!("DUN7nniuatsMC7ReCh5eJRQExnutppN1tAfjfXFmGDq3");

#[program]
pub mod clone {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        ctx.accounts.vault.token_account = ctx.accounts.token_account.key();
        ctx.accounts.vault.authority = ctx.accounts.authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32,
    )]
    pub vault: Account<'info, Vault>,
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

## 2. Instrucciones para la prueba **insecure_withdraw**

El archivo de prueba incluye una prueba para invocar la instrucción **initialize_vault** en el programa **owner_check** utilizando la billetera del proveedor como **authority** y luego acuña 100 tokens en la cuenta de token.

El archivo de prueba también incluye una prueba para invocar la instrucción **initialize_vault** en el programa **clone** para inicializar una cuenta de **vault** falsa almacenando la misma cuenta de **tokenPDA** , pero a una **authority** diferente. Tenga en cuenta que aquí no se acuñan nuevos tokens.

Agreguemos una prueba para invocar la instrucción **insecure_withdraw** . Esta prueba debe pasar en la bóveda clonada y la autoridad falsa. Como no hay una comprobación de propietario para verificar que la cuenta **vaultClone** es propiedad del programa **owner_check**, la verificación de validación de datos de la instrucción pasará y mostrará **walletFake** como una autoridad válida. Los tokens de la cuenta **tokenPDA** se retirarán entonces a la cuenta **withdrawDestinationFake**.

```Rust
describe("owner-check", () => {
	...
    it("Insecure withdraw", async () => {
    const tx = await program.methods
        .insecureWithdraw()
        .accounts({
            vault: vaultClone.publicKey,
            tokenAccount: tokenPDA,
            withdrawDestination: withdrawDestinationFake,
            authority: walletFake.publicKey,
        })
        .transaction()

        await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletFake])

        const balance = await connection.getTokenAccountBalance(tokenPDA)
        expect(balance.value.uiAmount).to.eq(0)
    })

})
```

Ejecuta la **anchor test** para ver que la **insecure_withdraw** se completa con éxito.

```Rust
owner-check
  ✔ Initialize Vault (808ms)
  ✔ Initialize Fake Vault (404ms)
  ✔ Insecure withdraw (409ms)
```

Tenga en cuenta que **vaultClone** se deserializará con éxito a pesar de que Anchor inicia automáticamente las nuevas cuentas con un discriminador único de 8 bytes y verifica el discriminador al deserializar una cuenta. Esto se debe a que el discriminador es una hash del nombre del tipo de cuenta.

Dado que ambos programas inician cuentas idénticas y ambos structs tienen el mismo nombre **Vault** , las cuentas tienen el mismo discriminador a pesar de que son propiedad de diferentes programas.

## 3. Agregar la instrucción **secure_withdraw**

Cerremos esta brecha de seguridad.

En el archivo **lib.rs** del programa **owner_check** agreguemos una instrucción **secure_withdraw** y una estructura de cuentas **SecureWithdraw** .
En la estructura **SecureWithdraw**, usemos **Account<'info, Vault>** para asegurar que se realiza una verificación de propietario en la cuenta de **vault**. También usaremos la restricción **has_one** para verificar que la **token_account** y la **authority** pasadas a la instrucción coincidan con los valores almacenados en la cuenta de **vault**.

```Rust
#[program]
pub mod owner_check {
    use super::*;
	...

	pub fn secure_withdraw(ctx: Context<SecureWithdraw>) -> Result<()> {
        let amount = ctx.accounts.token_account.amount;

        let seeds = &[
            b"token".as_ref(),
            &[*ctx.bumps.get("token_account").unwrap()],
        ];
        let signer = [&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.token_account.to_account_info(),
                to: ctx.accounts.withdraw_destination.to_account_info(),
            },
            &signer,
        );

        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }
}
...

#[derive(Accounts)]
pub struct SecureWithdraw<'info> {
    #[account(
       has_one = token_account,
       has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"token"],
        bump,
    )]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub authority: Signer<'info>,
}
```

## 4. Instrucciones para prueba **secure_withdraw**

Para probar la instrucción **secure_withdraw**, invocaremos la instrucción dos veces. Primero, invocaremos la instrucción utilizando la cuenta **vaultClone** , la cual esperamos que falle. Luego, invocaremos la instrucción utilizando la cuenta de **vault** correcta para verificar que la instrucción funciona como se desea.

```Rust
describe("owner-check", () => {
	...
	it("Secure withdraw, expect error", async () => {
        try {
            const tx = await program.methods
                .secureWithdraw()
                .accounts({
                    vault: vaultClone.publicKey,
                    tokenAccount: tokenPDA,
                    withdrawDestination: withdrawDestinationFake,
                    authority: walletFake.publicKey,
                })
                .transaction()

            await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletFake])
        } catch (err) {
            expect(err)
            console.log(err)
        }
    })

    it("Secure withdraw", async () => {
        await spl.mintTo(
            connection,
            wallet.payer,
            mint,
            tokenPDA,
            wallet.payer,
            100
        )

        await program.methods
        .secureWithdraw()
        .accounts({
            vault: vault.publicKey,
            tokenAccount: tokenPDA,
            withdrawDestination: withdrawDestination,
            authority: wallet.publicKey,
        })
        .rpc()

        const balance = await connection.getTokenAccountBalance(tokenPDA)
        expect(balance.value.uiAmount).to.eq(0)
    })
})
```

Ejecuta la **anchor test** para ver que la transacción al estar utilizando la cuenta **vaultClone** devuelve un error de Anchor mientras que la transacción utilizando la cuenta de **vault** se completa con éxito.

```Rust
'Program HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB invoke [1]',
'Program log: Instruction: SecureWithdraw',
'Program log: AnchorError caused by account: vault. Error Code: AccountOwnedByWrongProgram. Error Number: 3007. Error Message: The given account is owned by a different program than expected.',
'Program log: Left:',
'Program log: DUN7nniuatsMC7ReCh5eJRQExnutppN1tAfjfXFmGDq3',
'Program log: Right:',
'Program log: HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB',
'Program HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB consumed 5554 of 200000 compute units',
'Program HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB failed: custom program error: 0xbbf'
```

Aquí vemos cómo el uso del tipo de cuenta **Account<'info, T>** de Anchor puede simplificar el proceso de validación de cuentas para automatizar la verificación de propiedad. Además, tenga en cuenta que los errores de Anchor pueden especificar la cuenta que causa el error (por ejemplo, la tercera línea de los registros anteriormente mencionados dice **AnchorError caused by account: vault** ). Esto puede ser muy útil al depurar.

```Rust
✔ Secure withdraw, expect error (78ms)
✔ Secure withdraw (10063ms)
```

¡Eso es todo lo que necesitas para asegurarte de verificar la propiedad de una cuenta! Al igual que con algunas otras explotaciones, es bastante simple evitarlas, pero muy importante. Asegúrate siempre de pensar en qué cuentas deben ser propiedad de qué programas y de asegurarte de agregar una validación adecuada.

Si deseas ver el código de **solution**, puedes encontrarlo en el [repositorio](https://github.com/Unboxed-Software/solana-owner-checks/tree/solution).

# Desafío

Al igual que con otras lecciones de este módulo, tu oportunidad de practicar para evitar esta explotación de seguridad radica en revisar tus propios programas o de otras personas.

Tómate un tiempo para revisar al menos un programa y asegurarte de que se realizan las verificaciones de propietario adecuadas en las cuentas, pasadas a cada instrucción.

Recuerda, si encuentras un error o explotación en el programa de alguien más, ¡notifícaselo! Si encuentras uno en tu propio programa, asegúrate de corregirlo de inmediato.
