---
title: Tipo Objetivos del cosplay
objectives:
- Explicar los riesgos de seguridad asociados con no verificar los tipos de cuenta
- Implementar un discriminador de tipo de cuenta usando Rust de formato largo
- Utilice la `init` restricción de Anchor para inicializar cuentas
- Usar el `Account` tipo de Ancla para la validación de la cuenta
---

# TL;DR

-   Usar discriminadores para distinguir entre diferentes tipos de cuentas
-   Para implementar un discriminador en Rust, incluya un campo en la estructura de la cuenta para representar el tipo de cuenta

    ```rust
    #[derive(BorshSerialize, BorshDeserialize)]
    pub struct User {
        discriminant: AccountDiscriminant,
        user: Pubkey,
    }

    #[derive(BorshSerialize, BorshDeserialize, PartialEq)]
    pub enum AccountDiscriminant {
        User,
        Admin,
    }
    ```

-   Para implementar una verificación de discriminador en Rust, verifique que el discriminador de los datos de la cuenta deserializada coincida con el valor esperado

    ```rust
    if user.discriminant != AccountDiscriminant::User {
        return Err(ProgramError::InvalidAccountData.into());
    }
    ```

-   En Anchor, los tipos de cuenta de programa implementan automáticamente el `Discriminator` rasgo que crea un identificador único de 8 bytes para un tipo
-   Utilice el `Account<'info, T>` tipo de Ancla para comprobar automáticamente el discriminador de la cuenta al deserializar los datos de la cuenta

# Descripción general

"Tipo de cosplay" se refiere a un tipo de cuenta inesperado que se utiliza en lugar de un tipo de cuenta esperado. Bajo el capó, los datos de la cuenta se almacenan simplemente como una matriz de bytes que un programa deserializa en un tipo de cuenta personalizado. Sin implementar una forma de distinguir explícitamente entre los tipos de cuenta, los datos de la cuenta de una cuenta inesperada podrían dar como resultado que una instrucción se use de manera involuntaria.

### Cuenta no verificada

En el siguiente ejemplo, tanto el tipo de `AdminConfig` `UserConfig` cuenta como el tipo de cuenta almacenan una única clave pública. La `admin_instruction` instrucción deserializa la `admin_config` cuenta como un `AdminConfig` tipo y luego realiza una verificación del propietario y una verificación de validación de datos.

Sin embargo, los tipos de `UserConfig` cuenta `AdminConfig` y tienen la misma estructura de datos. Esto significa que se puede pasar un tipo de `UserConfig` cuenta como la `admin_config` cuenta. Mientras la clave pública almacenada en los datos de la cuenta coincida con la `admin` firma de la transacción, la `admin_instruction` instrucción continuará procesándose, incluso si el firmante no es realmente un administrador.

Tenga en cuenta que los nombres de los campos almacenados en los tipos de cuenta ( `admin` y `user`) no hacen ninguna diferencia al deserializar los datos de la cuenta. Los datos se serializan y deserializan en función del orden de los campos en lugar de sus nombres.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod type_cosplay_insecure {
    use super::*;

    pub fn admin_instruction(ctx: Context<AdminInstruction>) -> Result<()> {
        let account_data =
            AdminConfig::try_from_slice(&ctx.accounts.admin_config.data.borrow()).unwrap();
        if ctx.accounts.admin_config.owner != ctx.program_id {
            return Err(ProgramError::IllegalOwner.into());
        }
        if account_data.admin != ctx.accounts.admin.key() {
            return Err(ProgramError::InvalidAccountData.into());
        }
        msg!("Admin {}", account_data.admin);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct AdminInstruction<'info> {
    admin_config: UncheckedAccount<'info>,
    admin: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct AdminConfig {
    admin: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct UserConfig {
    user: Pubkey,
}
```

### Añadir discriminador de cuenta

Para resolver esto, puede agregar un campo discriminante para cada tipo de cuenta y establecer el discriminante al inicializar una cuenta.

El siguiente ejemplo actualiza los tipos de `UserConfig` cuenta `AdminConfig` y con un `discriminant` campo. La `admin_instruction` instrucción incluye una comprobación de validación de datos adicional para el `discriminant` campo.

```rust
if account_data.discriminant != AccountDiscriminant::Admin {
    return Err(ProgramError::InvalidAccountData.into());
}
```

Si el `discriminant` campo de la cuenta pasa a la instrucción ya que la `admin_config` cuenta no coincide con lo esperado `AccountDiscriminant`, entonces la transacción fallará. Simplemente asegúrese de establecer el valor apropiado para `discriminant` cuando inicializa cada cuenta (no se muestra en el ejemplo), y luego puede incluir estas comprobaciones discriminantes en cada instrucción posterior.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod type_cosplay_secure {
    use super::*;

    pub fn admin_instruction(ctx: Context<AdminInstruction>) -> Result<()> {
        let account_data =
            AdminConfig::try_from_slice(&ctx.accounts.admin_config.data.borrow()).unwrap();
        if ctx.accounts.admin_config.owner != ctx.program_id {
            return Err(ProgramError::IllegalOwner.into());
        }
        if account_data.admin != ctx.accounts.admin.key() {
            return Err(ProgramError::InvalidAccountData.into());
        }
        if account_data.discriminant != AccountDiscriminant::Admin {
            return Err(ProgramError::InvalidAccountData.into());
        }
        msg!("Admin {}", account_data.admin);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct AdminInstruction<'info> {
    admin_config: UncheckedAccount<'info>,
    admin: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct AdminConfig {
    discriminant: AccountDiscriminant,
    admin: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct UserConfig {
    discriminant: AccountDiscriminant,
    user: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize, PartialEq)]
pub enum AccountDiscriminant {
    Admin,
    User,
}
```

### Utilice la `Account` envoltura de Anchor

Implementar estas comprobaciones para cada cuenta necesaria para cada instrucción puede ser tedioso. Afortunadamente, Anchor proporciona una macro de `#[account]` atributos para implementar automáticamente los rasgos que cada cuenta debería tener.

Las estructuras marcadas con `#[account]` pueden usarse con `Account` para validar que la cuenta pasada es, de hecho, el tipo que espera que sea. Al inicializar una cuenta cuya representación estructural tiene el `#[account]` atributo, los primeros 8 bytes se reservan automáticamente para un discriminador único para el tipo de cuenta. Al deserializar los datos de la cuenta, Anchor verificará automáticamente si el discriminador en la cuenta coincide con el tipo de cuenta esperado y lanzará y errará si no coincide.

En el siguiente ejemplo, `Account<'info, AdminConfig>` especifica que la `admin_config` cuenta debe ser de tipo `AdminConfig`. Anchor comprueba entonces automáticamente que los primeros 8 bytes de datos de cuenta coinciden con el discriminador del `AdminConfig` tipo.

La verificación de validación de datos para el `admin` campo también se mueve de la lógica de instrucción a la estructura de validación de cuenta utilizando la `has_one` restricción. `#[account(has_one = admin)]` especifica que el `admin` campo de la `admin_config` cuenta debe coincidir con la `admin` cuenta pasada a la instrucción. Tenga en cuenta que para que la `has_one` restricción funcione, el nombre de la cuenta en la estructura debe coincidir con el nombre del campo en la cuenta que está validando.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod type_cosplay_recommended {
    use super::*;

    pub fn admin_instruction(ctx: Context<AdminInstruction>) -> Result<()> {
        msg!("Admin {}", ctx.accounts.admin_config.admin);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct AdminInstruction<'info> {
    #[account(has_one = admin)]
    admin_config: Account<'info, AdminConfig>,
    admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}

#[account]
pub struct UserConfig {
    user: Pubkey,
}
```

Es importante tener en cuenta que esta es una vulnerabilidad de la que realmente no tiene que preocuparse cuando usa Anchor, ¡ese es el punto en primer lugar! Después de analizar cómo se puede explotar esto si no se maneja adecuadamente en un programa de óxido nativo, es de esperar que tenga una mejor comprensión de cuál es el propósito del discriminador de cuentas en una cuenta de Anchor. El hecho de que Anchor establezca y verifique este discriminador automáticamente significa que los desarrolladores pueden pasar más tiempo enfocándose en su producto, pero aún así es muy importante entender lo que Anchor está haciendo detrás de escena para desarrollar programas robustos de Solana.

# Demostración

Para esta demostración, crearemos dos programas para demostrar una vulnerabilidad de cosplay de tipo.

-   El primer programa inicializará las cuentas del programa sin un discriminador
-   El segundo programa inicializará las cuentas del programa utilizando la `init` restricción de Anchor, que establece automáticamente un discriminador de cuentas.

### 1. Arranque

Para comenzar, descargue el código de inicio de la `starter` sucursal de[este repositorio](https://github.com/Unboxed-Software/solana-type-cosplay/tree/starter). El código de inicio incluye un programa con tres instrucciones y algunas pruebas.

Las tres instrucciones son:

1.  `initialize_admin` - inicializa una cuenta de administrador y establece la autoridad de administración del programa
2.  `initialize_user` - inicializa una cuenta de usuario estándar
3.  `update_admin` - permite al administrador existente actualizar la autoridad administrativa del programa

Echa un vistazo a estas tres instrucciones en el `lib.rs` archivo. La última instrucción solo debe ser invocable por la cuenta que coincida con el `admin` campo en la cuenta de administrador inicializada utilizando la `initialize_admin` instrucción.

### 2. `update_admin` Instrucción de prueba insegura

Sin embargo, ambas cuentas tienen los mismos campos y tipos de campos:

```rust
#[derive(BorshSerialize, BorshDeserialize)]
pub struct AdminConfig {
    admin: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct User {
    user: Pubkey,
}
```

Debido a esto, es posible pasar una `User` cuenta en lugar de la `admin` cuenta en la `update_admin` instrucción, evitando así el requisito de que uno sea un administrador para llamar a esta instrucción.

Echa un vistazo al `solana-type-cosplay.ts` archivo en el `tests` directorio. Contiene una configuración básica y dos pruebas. Una prueba inicializa una cuenta de usuario, y la otra invoca `update_admin` y pasa en la cuenta de usuario en lugar de una cuenta de administrador.

Ejecute `anchor test` para ver que la invocación `update_admin` se completará correctamente.

```bash
  type-cosplay
    ✔ Initialize User Account (233ms)
    ✔ Invoke update admin instruction with user account (487ms)
```

### 3. Crear `type-checked` programa

Ahora crearemos un nuevo programa llamado ejecutándose `type-checked` `anchor new type-checked` desde la raíz del programa de anclaje existente.

Ahora en su `programs` carpeta tendrá dos programas. Ejecute `anchor keys list` y verá el ID del programa para el nuevo programa. Añádalo al `lib.rs` archivo del `type-checked` programa y al `type_checked` programa en el `Anchor.toml` archivo.

A continuación, actualice la configuración del archivo de prueba para incluir el nuevo programa y dos nuevos pares de teclas para las cuentas que iniciaremos para el nuevo programa.

```tsx
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TypeCosplay } from "../target/types/type_cosplay";
import { TypeChecked } from "../target/types/type_checked";
import { expect } from "chai";

describe("type-cosplay", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.TypeCosplay as Program<TypeCosplay>;
    const programChecked = anchor.workspace.TypeChecked as Program<TypeChecked>;

    const userAccount = anchor.web3.Keypair.generate();
    const newAdmin = anchor.web3.Keypair.generate();

    const userAccountChecked = anchor.web3.Keypair.generate();
    const adminAccountChecked = anchor.web3.Keypair.generate();
});
```

### 4. Implementar el `type-checked` programa

En el `type_checked` programa, añada dos instrucciones usando la `init` restricción para inicializar una `AdminConfig` cuenta y una `User` cuenta. Al usar la `init` restricción para inicializar nuevas cuentas de programa, Anchor establecerá automáticamente los primeros 8 bytes de datos de cuenta como un discriminador único para el tipo de cuenta.

También añadiremos una `update_admin` instrucción que valide la `admin_config` cuenta como un tipo de `AdminConfig` cuenta utilizando el `Account` envoltorio de Anchor. Para cualquier cuenta que se pase como `admin_config` cuenta, Anchor verificará automáticamente que el discriminador de cuenta coincida con el tipo de cuenta esperado.

```rust
use anchor_lang::prelude::*;

declare_id!("FZLRa6vX64QL6Vj2JkqY1Uzyzjgi2PYjCABcDabMo8U7");

#[program]
pub mod type_checked {
    use super::*;

    pub fn initialize_admin(ctx: Context<InitializeAdmin>) -> Result<()> {
        ctx.accounts.admin_config.admin = ctx.accounts.admin.key();
        Ok(())
    }

    pub fn initialize_user(ctx: Context<InitializeUser>) -> Result<()> {
        ctx.accounts.user_account.user = ctx.accounts.user.key();
        Ok(())
    }

    pub fn update_admin(ctx: Context<UpdateAdmin>) -> Result<()> {
        ctx.accounts.admin_config.admin = ctx.accounts.admin.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeAdmin<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + 32
    )]
    pub admin_config: Account<'info, AdminConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeUser<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32
    )]
    pub user_account: Account<'info, User>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(
        mut,
        has_one = admin
    )]
    pub admin_config: Account<'info, AdminConfig>,
    pub new_admin: SystemAccount<'info>,
    #[account(mut)]
    pub admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}

#[account]
pub struct User {
    user: Pubkey,
}
```

### 5. Instrucciones de prueba `update_admin` segura

En el archivo de prueba, inicializaremos una `AdminConfig` cuenta y una `User` cuenta del `type_checked` programa. Luego invocaremos la `updateAdmin` instrucción que pasa dos veces en las cuentas recién creadas.

```rust
describe("type-cosplay", () => {
	...

  it("Initialize type checked AdminConfig Account", async () => {
    await programChecked.methods
      .initializeAdmin()
      .accounts({
        adminConfig: adminAccountType.publicKey,
      })
      .signers([adminAccountType])
      .rpc()
  })

  it("Initialize type checked User Account", async () => {
    await programChecked.methods
      .initializeUser()
      .accounts({
        userAccount: userAccountType.publicKey,
        user: provider.wallet.publicKey,
      })
      .signers([userAccountType])
      .rpc()
  })

  it("Invoke update instruction using User Account", async () => {
    try {
      await programChecked.methods
        .updateAdmin()
        .accounts({
          adminConfig: userAccountType.publicKey,
          newAdmin: newAdmin.publicKey,
          admin: provider.wallet.publicKey,
        })
        .rpc()
    } catch (err) {
      expect(err)
      console.log(err)
    }
  })

  it("Invoke update instruction using AdminConfig Account", async () => {
    await programChecked.methods
      .updateAdmin()
      .accounts({
        adminConfig: adminAccountType.publicKey,
        newAdmin: newAdmin.publicKey,
        admin: provider.wallet.publicKey,
      })
      .rpc()
  })
})
```

Ejecutar `anchor test`. Para la transacción en la que pasamos en el tipo de `User` cuenta, esperamos la instrucción y devolvemos un error de anclaje para la cuenta que no es de tipo `AdminConfig`.

```bash
'Program EU66XDppFCf2Bg7QQr59nyykj9ejWaoW93TSkk1ufXh3 invoke [1]',
'Program log: Instruction: UpdateAdmin',
'Program log: AnchorError caused by account: admin_config. Error Code: AccountDiscriminatorMismatch. Error Number: 3002. Error Message: 8 byte discriminator did not match what was expected.',
'Program EU66XDppFCf2Bg7QQr59nyykj9ejWaoW93TSkk1ufXh3 consumed 4765 of 200000 compute units',
'Program EU66XDppFCf2Bg7QQr59nyykj9ejWaoW93TSkk1ufXh3 failed: custom program error: 0xbba'
```

Seguir las mejores prácticas de Anchor y usar tipos de Anchor asegurará que sus programas eviten esta vulnerabilidad. Siempre use el `#[account]` atributo al crear estructuras de cuenta, use la `init` restricción al inicializar cuentas y use el `Account` tipo en las estructuras de validación de su cuenta.

Si desea echar un vistazo al código de la solución final, puede encontrarlo en la `solution` rama de[el repositorio](https://github.com/Unboxed-Software/solana-type-cosplay/tree/solution).

# Desafío

Al igual que con otras lecciones de este módulo, su oportunidad de practicar evitando este exploit de seguridad radica en auditar sus propios programas u otros.

Tómese un tiempo para revisar al menos un programa y asegúrese de que los tipos de cuenta tengan un discriminador y que se verifiquen para cada cuenta e instrucción. Dado que los tipos de ancla estándar manejan esta verificación automáticamente, es más probable que encuentre una vulnerabilidad en un programa nativo.

Recuerde, si encuentra un error o un exploit en el programa de otra persona, ¡avíselos! Si encuentra uno en su propio programa, asegúrese de parchearlo de inmediato.
