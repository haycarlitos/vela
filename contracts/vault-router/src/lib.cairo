//! A router that lets an agent's session key use an ERC-4626 vault without
//! being able to send the money anywhere else.
//!
//! A vault's `deposit` and `withdraw` take a `receiver`: whoever can call them
//! can name any address, and the wallet's spending policies do not meter them.
//! A session key's whitelist holds function names (selectors), valid on every
//! contract, so it cannot allow `withdraw` "only with receiver = me". The
//! session whitelists `deposit_to_self` and `withdraw_to_self` instead (and
//! never `deposit` or `withdraw`). They take no receiver: the shares and the
//! assets always go back to the caller.
//!
//! Those two names are valid on any contract too, so the router alone is not
//! the guarantee. The guarantee is that money only moves through capped calls:
//! depositing needs an `approve` of the asset to this router, and withdrawing
//! an `approve` of the vault's shares (at least `preview_withdraw(assets)`).
//! The session's spending policies meter both, so the shares need a real cap,
//! in share units (18 decimals for Vesu). A contract that merely exposes the
//! same names gets nothing without one of those approvals.
//!
//! The router has no owner and holds nothing between transactions. Tokens
//! sent to it directly are lost: there is no way to sweep them.

use starknet::ContractAddress;

#[starknet::interface]
pub trait IVaultRouter<TState> {
    /// Moves `assets` of the vault's token from the caller into the vault.
    /// The caller gets the shares. Needs `asset.approve(router, assets)` first.
    fn deposit_to_self(ref self: TState, assets: u256) -> u256;
    /// Takes `assets` out of the caller's vault position and sends them to the
    /// caller. Needs `vault.approve(router, shares)` first, for at least
    /// `vault.preview_withdraw(assets)` shares.
    fn withdraw_to_self(ref self: TState, assets: u256) -> u256;
    /// The one vault this router serves.
    fn vault(self: @TState) -> ContractAddress;
}

#[starknet::interface]
pub trait IERC4626<TState> {
    fn asset(self: @TState) -> ContractAddress;
    fn deposit(ref self: TState, assets: u256, receiver: ContractAddress) -> u256;
    fn withdraw(
        ref self: TState, assets: u256, receiver: ContractAddress, owner: ContractAddress,
    ) -> u256;
}

#[starknet::interface]
pub trait IERC20<TState> {
    fn transfer_from(
        ref self: TState, sender: ContractAddress, recipient: ContractAddress, amount: u256,
    ) -> bool;
    fn approve(ref self: TState, spender: ContractAddress, amount: u256) -> bool;
}

#[starknet::contract]
pub mod VaultRouter {
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use super::{
        IERC20Dispatcher, IERC20DispatcherTrait, IERC4626Dispatcher, IERC4626DispatcherTrait,
    };

    #[storage]
    struct Storage {
        vault: ContractAddress,
        asset: ContractAddress,
    }

    /// One router per vault: the vault cannot be swapped for a malicious one
    /// at call time.
    #[constructor]
    fn constructor(ref self: ContractState, vault: ContractAddress) {
        self.vault.write(vault);
        self.asset.write(IERC4626Dispatcher { contract_address: vault }.asset());
    }

    #[abi(embed_v0)]
    impl VaultRouterImpl of super::IVaultRouter<ContractState> {
        fn deposit_to_self(ref self: ContractState, assets: u256) -> u256 {
            let caller = get_caller_address();
            let vault = self.vault.read();
            let asset = IERC20Dispatcher { contract_address: self.asset.read() };
            // The assets pass through the router within this one transaction.
            assert(
                asset.transfer_from(caller, get_contract_address(), assets), 'transfer_from failed',
            );
            assert(asset.approve(vault, assets), 'approve failed');
            IERC4626Dispatcher { contract_address: vault }.deposit(assets, caller)
        }

        fn withdraw_to_self(ref self: ContractState, assets: u256) -> u256 {
            let caller = get_caller_address();
            // receiver and owner are both the caller: no way to name anyone else.
            IERC4626Dispatcher { contract_address: self.vault.read() }
                .withdraw(assets, caller, caller)
        }

        fn vault(self: @ContractState) -> ContractAddress {
            self.vault.read()
        }
    }
}
