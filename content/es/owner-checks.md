---
title: El propietario comprueba los objetivos
objectives:
- Explicar los riesgos de seguridad asociados con no realizar las comprobaciones apropiadas del propietario
- Implementar comprobaciones de propietario usando Rust de formato largo
- Utilice el `Account<'info, T>` envoltorio de Anchor y un tipo de cuenta para automatizar los cheques de propietario
- Utilice la `#[account(owner = <expr>)]` restricción de Anchor para definir explícitamente un programa externo que debería poseer una cuenta.
---

# TL;DR

-   Se utiliza **Cheques del propietario** para verificar que las cuentas son propiedad del programa esperado. Sin cheques de propietario apropiados, las cuentas propiedad de programas inesperados podrían usarse en una instrucción.
-   Para implementar un registro de propietario en Rust, simplemente verifique que el propietario de una cuenta coincida con un ID de programa esperado

```rust
if ctx.accounts.account.owner != ctx.program_id {
    return Err(ProgramError::IncorrectProgramId.into());
}
```

-   Los tipos de cuenta de programa de anclaje implementan el `Owner` rasgo que permite que la `Account<'info, T>` envoltura verifique automáticamente la propiedad del programa
-   Anchor le da la opción de definir explícitamente el propietario de una cuenta si debe ser otra cosa que no sea el programa que se está ejecutando actualmente.

# Descripción general

Los cheques de propietario se utilizan para verificar que una cuenta pasada a una instrucción es propiedad de un programa esperado. Esto evita que las cuentas propiedad de un programa inesperado se utilicen en una instrucción.

Como actualización, la `AccountInfo` estructura contiene los siguientes campos. Una comprobación de propietario se refiere a comprobar que el `owner` campo en el campo `AccountInfo` coincide con un ID de programa esperado.

```jsx
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

### Cheque de propietario faltante

El siguiente ejemplo muestra una `admin_instruction` intención de ser accesible sólo por una `admin` cuenta almacenada en una `admin_config` cuenta.

Aunque la instrucción comprueba que la `admin` cuenta firmó la transacción y coincide con el `admin` campo almacenado en la `admin_config` cuenta, no hay comprobación de propietario para verificar que la `admin_config` cuenta pasada a la instrucción es propiedad del programa de ejecución.

Dado que el no `admin_config` está marcado como se indica por el `AccountInfo` tipo, una `admin_config` cuenta falsa propiedad de un programa diferente podría ser utilizado en el `admin_instruction`. Esto significa que un atacante podría crear un programa con una estructura de datos `admin_config` que coincida con la `admin_config` de su programa, establecer su clave pública como la `admin` y pasar su `admin_config` cuenta a su programa. Esto les permitiría falsificar efectivamente su programa en el pensamiento de que son el administrador autorizado para su programa.

Este ejemplo simplificado solo imprime `admin` los registros del programa. Sin embargo, puede imaginar cómo un cheque de propietario faltante podría permitir que las cuentas falsas exploten una instrucción.

```rust
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

### Añadir cheque de propietario

En Vanilla Rust, puede resolver este problema comparando el `owner` campo de la cuenta con el ID del programa. Si no coinciden, devolverías un `IncorrectProgramId` error.

```rust
if ctx.accounts.admin_config.owner != ctx.program_id {
    return Err(ProgramError::IncorrectProgramId.into());
}
```

Agregar un cheque de propietario evita que las cuentas propiedad de un programa inesperado se pasen como la `admin_config` cuenta. Si se usara una `admin_config` cuenta falsa en el `admin_instruction`, entonces la transacción fallaría.

```rust
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

### Usar Anchor 's `Account<'info, T>`

Ancla puede hacer esto más simple con el `Account` tipo.

`Account<'info, T>` es una envoltura  `AccountInfo` que verifica la propiedad del programa y deserializa los datos subyacentes en el tipo de cuenta especificado `T`. Esto a su vez le permite utilizar `Account<'info, T>` para validar fácilmente la propiedad.

Para el contexto, el `#[account]` atributo implementa varios rasgos para una estructura de datos que representa una cuenta. Uno de estos es el `Owner` rasgo que define una dirección que se espera que sea propietaria de una cuenta. El propietario se establece como el ID de programa especificado en la `declare_id!` macro.

En el siguiente ejemplo, `Account<'info, AdminConfig>` se utiliza para validar el `admin_config`. Esto realizará automáticamente la verificación del propietario y deserializará los datos de la cuenta. Además, la `has_one` restricción se utiliza para comprobar que la `admin` cuenta coincide con el `admin` campo almacenado en la `admin_config` cuenta.

De esta manera, no necesita saturar su lógica de instrucciones con cheques de propietario.

```rust
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

### Usar la `#[account(owner = <expr>)]` restricción de Anchor

Además del `Account` tipo, puede usar una `owner` restricción. La `owner` restricción le permite definir el programa que debería poseer una cuenta si es diferente de la que se está ejecutando actualmente. Esto es útil si, por ejemplo, está escribiendo una instrucción que espera que una cuenta sea un PDA derivado de un programa diferente. Puede usar las `bump` restricciones `seeds` and y definir las `owner` para derivar y verificar correctamente la dirección de la cuenta transferida.

Para usar la `owner` restricción, tendrá que tener acceso a la clave pública del programa que espera tener una cuenta. Puede pasar el programa como una cuenta adicional o codificar la clave pública en algún lugar de su programa.

```rust
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

En esta demostración, usaremos dos programas para demostrar cómo un cheque de propietario faltante podría permitir que una cuenta falsa drene los tokens de una cuenta de "bóveda" de tokens simplificada (tenga en cuenta que esto es muy similar a la demostración de la lección Autorización del firmante).

Para ayudar a ilustrar esto, a un programa le faltará un cheque de propietario de cuenta en la cuenta de bóveda a la que retira los tokens.

El segundo programa será un clon directo del primer programa creado por un usuario malicioso para crear una cuenta idéntica a la cuenta de bóveda del primer programa.

Sin la verificación del propietario, este usuario malicioso podrá pasar a la cuenta de la bóveda propiedad de su programa "falso" y el programa original aún se ejecutará.

### 1. Arranque

Para comenzar, descargue el código de inicio de la `starter` sucursal de[este repositorio](https://github.com/Unboxed-Software/solana-owner-checks/tree/starter). El código de arranque incluye dos programas `clone` `owner_check` y la configuración de la caldera para el archivo de prueba.

El `owner_check` programa incluye dos instrucciones:

-   `initialize_vault` inicializa una cuenta de bóveda simplificada que almacena las direcciones de una cuenta de token y una cuenta de autoridad
-   `insecure_withdraw` retira tokens de la cuenta de token, pero le falta un cheque de propietario para la cuenta de bóveda

```rust
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

El `clone` programa incluye una única instrucción:

-   `initialize_vault` inicializa una cuenta de "bóveda" que imita la cuenta de bóveda del `owner_check` programa. Almacena la dirección de la cuenta de token de la bóveda real, pero permite al usuario malicioso poner su propia cuenta de autoridad.

```rust
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

### 2. `insecure_withdraw` Instrucciones de prueba

El archivo de prueba incluye una prueba para invocar la `initialize_vault` instrucción en el `owner_check` programa utilizando la billetera del proveedor como el `authority` y luego acuña 100 tokens a la cuenta de tokens.

El archivo de prueba también incluye una prueba para invocar la `initialize_vault` instrucción en el `clone` programa para inicializar una `vault` cuenta falsa que almacena la misma `tokenPDA` cuenta, pero una diferente `authority`. Tenga en cuenta que no se acuñan nuevos tokens aquí.

Añadamos una prueba para invocar la `insecure_withdraw` instrucción. Esta prueba debe pasar en la bóveda clonada y la autoridad falsa. Dado que no hay un cheque de propietario para verificar que la `vaultClone` cuenta es propiedad del `owner_check` programa, la verificación de validación de datos de la instrucción pasará y se mostrará `walletFake` como una autoridad válida. Los tokens de la `tokenPDA` cuenta se retirarán a la `withdrawDestinationFake` cuenta.

```tsx
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

Ejecutar `anchor test` para ver que se `insecure_withdraw` completa correctamente.

```bash
owner-check
  ✔ Initialize Vault (808ms)
  ✔ Initialize Fake Vault (404ms)
  ✔ Insecure withdraw (409ms)
```

Tenga en cuenta que `vaultClone` deserializa con éxito a pesar de que Anchor inicia automáticamente nuevas cuentas con un discriminador único de 8 bytes y comprueba el discriminador al deserializar una cuenta. Esto se debe a que el discriminador es un hash del nombre del tipo de cuenta.

```rust
#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

Dado que ambos programas inicializan cuentas idénticas y ambas estructuras se nombran `Vault`, las cuentas tienen el mismo discriminador a pesar de que son propiedad de diferentes programas.

### 3. Añadir `secure_withdraw` instrucción

Vamos a cerrar esta laguna de seguridad.

En el `lib.rs` archivo del `owner_check` programa añadir una `secure_withdraw` instrucción y una estructura de `SecureWithdraw` cuentas.

En la `SecureWithdraw` estructura, usemos `Account<'info, Vault>` para asegurarnos de que se realiza una verificación del propietario en la `vault` cuenta. También usaremos la `has_one` restricción para verificar que el `token_account` y `authority` pasado a la instrucción coincida con los valores almacenados en la `vault` cuenta.

```rust
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

### 4. `secure_withdraw` Instrucciones de prueba

Para probar la `secure_withdraw` instrucción, vamos a invocar la instrucción dos veces. Primero, invocaremos la instrucción usando la `vaultClone` cuenta, que esperamos que falle. Luego, invocaremos la instrucción utilizando la `vault` cuenta correcta para verificar que la instrucción funcione según lo previsto.

```tsx
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

Ejecute `anchor test` para ver que la transacción usando la `vaultClone` cuenta ahora devolverá un error de anclaje mientras la transacción usando la `vault` cuenta se completa con éxito.

```bash
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

Aquí vemos cómo el uso del `Account<'info, T>` tipo de Anchor puede simplificar el proceso de validación de la cuenta para automatizar el control de propiedad. Además, tenga en cuenta que Anchor Errors puede especificar la cuenta que causa el error (por ejemplo, la tercera línea de los registros anteriores `AnchorError caused by account: vault`). Esto puede ser muy útil a la hora de depurar.

```bash
✔ Secure withdraw, expect error (78ms)
✔ Secure withdraw (10063ms)
```

¡Eso es todo lo que necesita para asegurarse de verificar al propietario en una cuenta! Al igual que otras hazañas, es bastante simple de evitar, pero muy importante. Asegúrese de pensar siempre en qué cuentas deben ser propiedad de qué programas y asegúrese de agregar la validación adecuada.

Si desea echar un vistazo al código de la solución final, puede encontrarlo en la `solution` rama de[el repositorio](https://github.com/Unboxed-Software/solana-owner-checks/tree/solution).

# Desafío

Al igual que con otras lecciones de este módulo, su oportunidad de practicar evitando este exploit de seguridad radica en auditar sus propios programas u otros.

Tómese un tiempo para revisar al menos un programa y asegúrese de que se realicen verificaciones adecuadas del propietario en las cuentas que se pasan a cada instrucción.

Recuerde, si encuentra un error o un exploit en el programa de otra persona, ¡avíselos! Si encuentra uno en su propio programa, asegúrese de parchearlo de inmediato.
