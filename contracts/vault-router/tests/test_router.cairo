//! Fork tests: the router against the real Vesu Re7 USDC Core vault and native
//! USDC on Starknet mainnet. Nothing is spent: snforge runs a local copy of
//! the chain state.

use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::ContractAddress;
use vault_router::{IVaultRouterDispatcher, IVaultRouterDispatcherTrait};

const VAULT: felt252 = 0x017891114c00b07317b9102adefbad9fd5de40c5616f094ee09fe2fad67191b1;
const USDC: felt252 = 0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb;
const ONE_USDC: u256 = 1_000_000;

#[starknet::interface]
trait IToken<T> {
    fn balance_of(self: @T, account: ContractAddress) -> u256;
    fn transfer(ref self: T, recipient: ContractAddress, amount: u256) -> bool;
    fn approve(ref self: T, spender: ContractAddress, amount: u256) -> bool;
}

#[starknet::interface]
trait IVesuVault<T> {
    fn pool_contract(self: @T) -> ContractAddress;
    fn preview_withdraw(self: @T, assets: u256) -> u256;
    fn max_withdraw(self: @T, owner: ContractAddress) -> u256;
}

fn addr(value: felt252) -> ContractAddress {
    value.try_into().unwrap()
}

fn usdc() -> ITokenDispatcher {
    ITokenDispatcher { contract_address: addr(USDC) }
}

fn shares() -> ITokenDispatcher {
    ITokenDispatcher { contract_address: addr(VAULT) }
}

fn deploy_router() -> IVaultRouterDispatcher {
    let class = declare("VaultRouter").unwrap().contract_class();
    let (address, _) = class.deploy(@array![VAULT]).unwrap();
    IVaultRouterDispatcher { contract_address: address }
}

/// Gives `who` some USDC, taken from the Vesu pool that holds the vault's assets.
fn fund(who: ContractAddress, amount: u256) {
    let pool = IVesuVaultDispatcher { contract_address: addr(VAULT) }.pool_contract();
    start_cheat_caller_address(addr(USDC), pool);
    assert(usdc().transfer(who, amount), 'fund failed');
    stop_cheat_caller_address(addr(USDC));
}

/// Calls `token.approve(spender, amount)` as `owner`.
fn approve_as(
    owner: ContractAddress, token: ITokenDispatcher, spender: ContractAddress, amount: u256,
) {
    start_cheat_caller_address(token.contract_address, owner);
    token.approve(spender, amount);
    stop_cheat_caller_address(token.contract_address);
}

/// Deposits `amount` USDC for `who` through the router; returns the shares.
fn deposit_as(router: IVaultRouterDispatcher, who: ContractAddress, amount: u256) -> u256 {
    approve_as(who, usdc(), router.contract_address, amount);
    start_cheat_caller_address(router.contract_address, who);
    let minted = router.deposit_to_self(amount);
    stop_cheat_caller_address(router.contract_address);
    minted
}

#[test]
#[fork("MAINNET")]
fn deposit_credits_the_caller() {
    let router = deploy_router();
    let agent = addr('agent');
    fund(agent, 10 * ONE_USDC);

    let minted = deposit_as(router, agent, 5 * ONE_USDC);

    assert(minted > 0, 'no shares minted');
    assert(shares().balance_of(agent) == minted, 'shares not with the caller');
    assert(usdc().balance_of(agent) == 5 * ONE_USDC, 'wrong USDC left');
    assert(usdc().balance_of(router.contract_address) == 0, 'router kept USDC');
    assert(shares().balance_of(router.contract_address) == 0, 'router kept shares');
}

#[test]
#[fork("MAINNET")]
fn withdraw_pays_the_caller() {
    let router = deploy_router();
    let agent = addr('agent');
    fund(agent, 10 * ONE_USDC);
    let minted = deposit_as(router, agent, 5 * ONE_USDC);

    let vault = IVesuVaultDispatcher { contract_address: addr(VAULT) };
    let needed = vault.preview_withdraw(2 * ONE_USDC);
    approve_as(agent, shares(), router.contract_address, needed);
    start_cheat_caller_address(router.contract_address, agent);
    let burned = router.withdraw_to_self(2 * ONE_USDC);
    stop_cheat_caller_address(router.contract_address);

    assert(burned == needed, 'unexpected shares burned');
    assert(shares().balance_of(agent) == minted - burned, 'shares not from the caller');
    assert(usdc().balance_of(agent) == 7 * ONE_USDC, 'USDC not back with the caller');
    assert(usdc().balance_of(router.contract_address) == 0, 'router kept USDC');
    assert(shares().balance_of(router.contract_address) == 0, 'router kept shares');
}

#[test]
#[fork("MAINNET")]
#[should_panic(expected: 'ERC20: insufficient allowance')]
fn withdraw_needs_a_share_approval() {
    let router = deploy_router();
    let agent = addr('agent');
    fund(agent, 10 * ONE_USDC);
    deposit_as(router, agent, 5 * ONE_USDC);

    // No vault.approve(router, ...): the session's share cap is what bounds withdrawals.
    start_cheat_caller_address(router.contract_address, agent);
    router.withdraw_to_self(ONE_USDC);
}

#[test]
#[fork("MAINNET")]
#[should_panic(expected: 'ERC20: insufficient balance')]
fn nobody_can_withdraw_someone_elses_position() {
    let router = deploy_router();
    let owner = addr('owner');
    let thief = addr('thief');
    fund(owner, 10 * ONE_USDC);
    let minted = deposit_as(router, owner, 5 * ONE_USDC);
    // Both approve the router for all the owner's shares, so an allowance
    // cannot be what stops the thief...
    approve_as(owner, shares(), router.contract_address, minted);
    approve_as(thief, shares(), router.contract_address, minted);

    // ...the thief can only ever withdraw the thief's own (empty) position.
    start_cheat_caller_address(router.contract_address, thief);
    router.withdraw_to_self(ONE_USDC);
}

#[test]
#[fork("MAINNET")]
#[should_panic(expected: 'Transfer allowance exceeded')]
fn deposit_needs_an_asset_approval() {
    let router = deploy_router();
    let agent = addr('agent');
    fund(agent, 10 * ONE_USDC);

    start_cheat_caller_address(router.contract_address, agent);
    router.deposit_to_self(ONE_USDC);
}

#[test]
#[fork("MAINNET")]
fn serves_one_fixed_vault() {
    assert(deploy_router().vault() == addr(VAULT), 'wrong vault');
}
