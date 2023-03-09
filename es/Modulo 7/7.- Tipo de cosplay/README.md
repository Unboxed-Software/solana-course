# Tipo de Cosplay

## Objetivos de la lección

_Al terminar esta lección podrás:_

- Explicar los riesgos de seguridad asociados con los tipos de cuentas no corrientes.
- Implementar un discriminador de tipo de cuenta usando Rust de formato largo.
- Use la restricción **init** de Anchor para inicializar cuentas.
- Use el tipo de **Account** de Anchor para la validación de la cuenta.

# Terminología

- Usar discriminadores para distinguir entre diferentes tipos de cuentas.
- Para implementar un discriminador en Rust, incluya un campo en la estructura de la cuenta para representar el tipo de cuenta.

```Rust
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

- Para implementar una verificación de discriminador en Rust, verifique que el discriminador de los datos de la cuenta deserializados coincida con el valor esperado.

```Rust
if user.discriminant != AccountDiscriminant::User {
    return Err(ProgramError::InvalidAccountData.into());
}
```

- En Anchor, los tipos de cuenta de programa implementan automáticamente el trait **Discriminator** , que crea un identificador único de 8 bytes por tipo.

- Use el tipo **Account<'info, T>** de Anchor para verificar automáticamente el discriminador de la cuenta al deserializar los datos de la cuenta.

# Resumen

El "tipo cosplay" se refiere a un tipo de cuenta inesperado que se utiliza en lugar de un tipo de cuenta esperado. En el interior, los datos de la cuenta se almacenan simplemente como una matriz de bytes que un programa deserializa en un tipo de cuenta personalizado. Sin implementar una forma de distinguir explícitamente entre los tipos de cuenta, los datos de una cuenta inesperada podrían resultar en una instrucción que se utiliza de manera no prevista.

## Cuenta no verificada

En el ejemplo a continuación, tanto el tipo de cuenta **AdminConfig** como el tipo de cuenta **UserConfig** almacenan una única clave pública. La instrucción **admin_instruction** deserializa la cuenta **admin_config** como un tipo **AdminConfig** y luego realiza una verificación de propietario y una verificación de validación de datos.

Sin embargo, los tipos de cuenta **AdminConfig** y **UserConfig** tienen la misma estructura de datos. Esto significa que un tipo de cuenta **UserConfig** se podría pasar como la cuenta **admin_config** . Siempre y cuando la clave pública almacenada en los datos de la cuenta coincida con la clave pública del **admin** que firma la transacción, la instrucción **admin_instruction** continuará su procesamiento, incluso si el firmante realmente no es un administrador.

Tenga en cuenta que los nombres de los campos almacenados en los tipos de cuenta ( **admin** y **user** ) no tienen ninguna diferencia al deserializar los datos de la cuenta. Los datos se serializan y deserializan en función del orden de los campos en lugar de sus nombres.

```Rust
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

## Agregar un discriminador de cuenta

Para resolver esto, puedes agregar un campo discriminante para cada tipo de cuenta y establecer el discriminante al inicializar una cuenta.

El ejemplo a continuación actualiza los tipos de cuenta **AdminConfig** y **UserConfig** con un campo **discriminant** . La instrucción **admin_instruction** incluye una verificación adicional de validación de datos para el campo **discriminant** .

```Rust
if account_data.discriminant != AccountDiscriminant::Admin {
    return Err(ProgramError::InvalidAccountData.into());
}
```

Si el campo **discriminant** de la cuenta pasa a la instrucción como la cuenta **admin_config** no coincide con el **AccountDiscriminant** esperado, entonces la transacción fallará. Simplemente asegúrese de establecer el valor apropiado para el **discriminant** al inicializar cada cuenta (no se muestra en el ejemplo) y luego puede incluir estas verificaciones discriminantes en cada instrucción subsiguiente.

```Rust
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

## Use el envoltorio **Account** de Anchor

Implementar estas verificaciones para cada cuenta necesaria para cada instrucción puede ser tedioso. Afortunadamente, Anchor proporciona una macro de atributo **#[account]** para implementar automáticamente los traits que todas las cuentas deben tener.
Las estructuras marcadas con **#[account]** luego pueden usarse con **Account** para validar que la cuenta pasada es realmente del tipo que se espera que sea. Al inicializar una cuenta cuya representación de estructura tiene el atributo **#[account]** , los primeros 8 bytes se reservan automáticamente para un discriminador único para el tipo de cuenta. Al deserializar los datos de la cuenta, Anchor verificará automáticamente si el discriminador de la cuenta coincide con el tipo de cuenta esperado y lanzará un error si no coincide.

En el ejemplo que se muestra a continuación, **Account<'info, AdminConfig>** especifica que la cuenta **admin_config** debe ser del tipo **AdminConfig** . Anchor luego verifica automáticamente que los primeros 8 bytes de los datos de la cuenta coinciden con el discriminador del tipo **AdminConfig** .

La verificación de validación de datos para el campo **admin** también se mueve desde la lógica de la instrucción a la estructura de validación de la cuenta utilizando la restricción **has_one** . **#[account(has_one = admin)]** especifica que el campo **admin** de la cuenta **admin_config** debe coincidir con la cuenta **admin** pasada a la instrucción. Tenga en cuenta que para que la restricción: **has_one** funcione, el nombre de la cuenta en la estructura debe coincidir con el nombre del campo en la cuenta que está validando.

```Rust
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

Es importante tener en cuenta que esta vulnerabilidad no es algo de lo que realmente tenga que preocuparse al usar Anchor, ¡ese es justamente el propósito de Anchor! Después de ver cómo se puede explotar si no se maneja correctamente en un programa de rust nativo, esperamos que tenga una mejor comprensión de cuál es el propósito del discriminador de cuenta en una cuenta de Anchor. El hecho de que Anchor establezca y verifique este discriminador automáticamente significa que los desarrolladores pueden pasar más tiempo enfocándose en su producto, pero sigue siendo muy importante comprender lo que Anchor está haciendo detrás de escena para desarrollar programas robustos de Solana.

# Demostración

Para esta demostración, crearemos dos programas que demostraran una vulnerabilidad de tipo cosplay.

- El primer programa inicializará las cuentas del programa sin un discriminador
- El segundo programa inicializará las cuentas del programa utilizando la restricción **init** de Anchor, que establece automáticamente un discriminador de cuenta.

## 1. Inicio

Para comenzar, descargue el código de inicio de la rama de **inicio** de este [repositorio](https://github.com/Unboxed-Software/solana-type-cosplay/tree/starter). El código de inicio incluye un programa con tres instrucciones y algunas pruebas.

Las tres instrucciones son:

1. **initialize_admin** - inicializa una cuenta de administrador y establece la autoridad de administrador del programa.
2. **initialize_user** - inicializa una cuenta de usuario estándar.
3. **update_admin** - permite al administrador existente actualizar la autoridad de administrador del programa.

Echa un vistazo a estas tres instrucciones en el archivo **lib.rs** . La última instrucción sólo debe ser llamada por la cuenta que coincida con el campo **admin** en la cuenta de administrador inicializada usando la instrucción **initialize_admin** .

## 2. Prueba la instrucción de actualización insegura **update_admin**

Sin embargo, ambas cuentas tienen los mismos campos y tipos de campos:

```Rust
#[derive(BorshSerialize, BorshDeserialize)]
pub struct AdminConfig {
    admin: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct User {
    user: Pubkey,
}
```

Debido a esto, es posible pasar una cuenta de **usuario** en lugar de una cuenta de **admin** en la instrucción **update_admin** , evitando así el requisito de ser administrador para llamar a esta instrucción.

Echa un vistazo al archivo **solana-type-cosplay.ts** en el directorio de **tests** . Contiene una configuración básica y dos pruebas. Una prueba inicializa una cuenta de usuario y la otra invoca **update_admin** y pasa la cuenta de usuario en lugar de una cuenta de administrador.

Ejecuta la **anchor test** para ver que al invocar **update_admin** se completará con éxito.

```Rust
type-cosplay
    ✔ Initialize User Account (233ms)
    ✔ Invoke update admin instruction with user account (487ms)
```

## 3. Crear un programa con **verificación de tipos**

Ahora crearemos un nuevo programa llamado **type-checked** ejecutando **anchor new type-checked** desde la raíz del programa anchor existente.

Ahora en su carpeta de **programs** tendrá dos programas. Ejecute **anchor keys list** y debería ver el ID del programa para el nuevo programa. Agreguelo al archivo **lib.rs** del programa **type-checked** y al programa **type_checked** en el archivo **Anchor.toml**

A continuación, actualice la configuración del archivo de pruebas para incluir el nuevo programa y dos nuevos conjuntos de claves para las cuentas que inicializaremos para el nuevo programa.

```Rust
import * as anchor from "@project-serum/anchor"
import { Program } from "@project-serum/anchor"
import { TypeCosplay } from "../target/types/type_cosplay"
import { TypeChecked } from "../target/types/type_checked"
import { expect } from "chai"

describe("type-cosplay", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.TypeCosplay as Program<TypeCosplay>
  const programChecked = anchor.workspace.TypeChecked as Program<TypeChecked>

  const userAccount = anchor.web3.Keypair.generate()
  const newAdmin = anchor.web3.Keypair.generate()

  const userAccountChecked = anchor.web3.Keypair.generate()
  const adminAccountChecked = anchor.web3.Keypair.generate()
})
```

## 4.Implementar el programa con **type-checked**

En el programa **type_checked** , agregue dos instrucciones utilizando la restricción **init** para inicializar una cuenta de **AdminConfig** y una cuenta de **User** . Al usar la restricción **init** para inicializar nuevas cuentas del programa, Anchor establecerá automáticamente los primeros 8 bytes de los datos de la cuenta como un discriminador único para el tipo de cuenta.

También agregaremos una instrucción **update_admin** que valida la cuenta **admin_config** como un tipo de cuenta **AdminConfig** utilizando el envoltorio **Account** de Anchor. Para cualquier cuenta pasada como cuenta **admin_config** , Anchor verificará automáticamente que el discriminador de la cuenta coincida con el tipo de cuenta esperado.

```Rust
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

## 5.Prueba de la instrucción **update_admin**

En el archivo de pruebas, inicializaremos una cuenta de **AdminConfig** y una cuenta de **User** desde el programa **type_checked** . Luego invocaremos la instrucción **updateAdmin** dos veces pasando las cuentas recién creadas.

```Rust
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

Ejecuta la **anchor test** . Para la transacción en la que pasamos el tipo de cuenta de **User** , esperamos que la instrucción devuelva un error de Anchor para la cuenta que no es del tipo **AdminConfig**.

```Rust
'Program EU66XDppFCf2Bg7QQr59nyykj9ejWaoW93TSkk1ufXh3 invoke [1]',
'Program log: Instruction: UpdateAdmin',
'Program log: AnchorError caused by account: admin_config. Error Code: AccountDiscriminatorMismatch. Error Number: 3002. Error Message: 8 byte discriminator did not match what was expected.',
'Program EU66XDppFCf2Bg7QQr59nyykj9ejWaoW93TSkk1ufXh3 consumed 4765 of 200000 compute units',
'Program EU66XDppFCf2Bg7QQr59nyykj9ejWaoW93TSkk1ufXh3 failed: custom program error: 0xbba'
```

Siguiendo las mejores prácticas de Anchor y utilizando los tipos de Anchor garantizará que sus programas eviten esta vulnerabilidad. Siempre utilice el atributo **#[account]** al crear estructuras de cuenta, utilice la restricción **init** al inicializar cuentas y utilice el tipo de **Account** en sus estructuras de validación de cuenta.

Si desea ver el código de solución final, puede encontrarlo en la rama de **solución** del [repositorio](https://github.com/Unboxed-Software/solana-type-cosplay/tree/solution).

# Reto

Al igual que con otras lecciones en este módulo, su oportunidad de practicar evitando esta explotación de seguridad radica en la revisión de sus propios programas o de otros programas.

Tómese un tiempo para revisar al menos un programa y asegurarse de que los tipos de cuenta tengan un discriminador y que se verifiquen para cada cuenta e instrucción. Dado que los tipos estándar de Anchor manejan esta verificación de forma automática, es más probable que encuentre una vulnerabilidad en un programa nativo.

Recuerde, si encuentra un error o explotación en el programa de alguien más, ¡por favor ¡avíseles! Si encuentra uno en su propio programa, asegúrese de repararlo de inmediato.
