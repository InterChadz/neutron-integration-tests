import Long from 'long';
import {
  CosmosWrapper,
  COSMOS_DENOM,
  NEUTRON_DENOM,
  WalletWrapper,
  getEventAttribute,
} from '../../helpers/cosmos';
import { NeutronContract } from '../../helpers/types';
import { msgCreateDenom } from '../../helpers/tokenfactory';

import { TestStateLocalCosmosTestNet } from '../common_localcosmosnet';
import { CodeId } from '../../types';

describe('Neutron / Simple', () => {
  let testState: TestStateLocalCosmosTestNet;
  let neutronChain: CosmosWrapper;
  let neutronAccount: WalletWrapper;
  let contractAddress: string;

  let gaiaChain: CosmosWrapper;
  let gaiaAccount: WalletWrapper;

  let newTokenDenom: string;

  beforeAll(async () => {
    testState = new TestStateLocalCosmosTestNet();
    await testState.init();
    neutronChain = new CosmosWrapper(
      testState.sdk1,
      testState.blockWaiter1,
      NEUTRON_DENOM,
    );
    neutronAccount = new WalletWrapper(
      neutronChain,
      testState.wallets.qaNeutron.genQaWal1,
    );

    gaiaChain = new CosmosWrapper(
      testState.sdk2,
      testState.blockWaiter2,
      COSMOS_DENOM,
    );
    gaiaAccount = new WalletWrapper(
      gaiaChain,
      testState.wallets.qaCosmos.genQaWal1,
    );
  });

  describe('Prepare for queries', () => {
    test('uatom IBC transfer from a remote chain to Neutron', async () => {
      const res = await gaiaAccount.msgIBCTransfer(
        'transfer',
        'channel-0',
        { denom: COSMOS_DENOM, amount: '1000' },
        neutronAccount.wallet.address.toString(),
        {
          revision_number: new Long(2),
          revision_height: new Long(100000000),
        },
      );
      expect(res.code).toEqual(0);
    });

    test('create denom, mint', async () => {
      const denom = `teststargate`;

      const data = await msgCreateDenom(
        neutronAccount,
        neutronAccount.wallet.address.toString(),
        denom,
      );
      newTokenDenom = getEventAttribute(
        (data as any).events,
        'create_denom',
        'new_token_denom',
      );
    });
  });

  describe('Contract instantiation', () => {
    let codeId: CodeId;
    test('store contract', async () => {
      codeId = await neutronAccount.storeWasm(NeutronContract.STARGATE_QUERIER);
      expect(codeId).toBeGreaterThan(0);
    });
    test('instantiate', async () => {
      const res = await neutronAccount.instantiateContract(
        codeId,
        '{}',
        'stargate_querier',
      );
      contractAddress = res[0]._contract_address;
    });
  });

  async function querySmart(query: any): Promise<string> {
    return await neutronChain.queryContract<string>(contractAddress, query);
  }

  describe('Stargate queries', () => {
    test('stargate query bank balance should work', async () => {
      const first = await querySmart({
        bank_balance: {
          address: neutronAccount.wallet.address.toString(),
          denom: NEUTRON_DENOM,
        },
      });
      const res = JSON.parse(first);
      expect(res.balance.denom).toBe('untrn');
      expect(+res.balance.amount).toBeGreaterThan(1000000);
    });

    test('stargate query bank denom metadata should work', async () => {
      const first = await querySmart({
        bank_denom_metadata: { denom: newTokenDenom },
      });
      const res = JSON.parse(first);
      expect(res.metadatas[0].denom_units[0].denom).toBe(newTokenDenom);
    });

    test('stargate query bank params should work', async () => {
      const first = await querySmart({ bank_params: {} });
      const res = JSON.parse(first);
      expect(res.params.default_send_enabled).toBe(true);
    });

    test('stargate query bank supply of should work', async () => {
      const first = await querySmart({
        bank_supply_of: { denom: NEUTRON_DENOM },
      });
      const res = JSON.parse(first);
      expect(res.amount.denom).toBe('untrn');
      expect(+res.amount.amount).toBeGreaterThan(1000000);
    });

    test('stargate query auth account should work', async () => {
      const first = await querySmart({
        auth_account: {
          address: neutronAccount.wallet.address.toString(),
        },
      });
      const res = JSON.parse(first);
      expect(res.account.address).toBe(
        neutronAccount.wallet.address.toString(),
      );
    });

    test('stargate query transfer denom trace should work', async () => {
      const first = await querySmart({
        transfer_denom_trace: {
          hash: 'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
        },
      });
      const res = JSON.parse(first);
      expect(res.denom_trace.path).toBe('transfer/channel-0');
      expect(res.denom_trace.base_denom).toBe('uatom');
    });

    test('stargate query ibc client state should work', async () => {
      const first = await querySmart({
        ibc_client_state: {
          client_id: '07-tendermint-1',
        },
      });
      const res = JSON.parse(first);
      expect(res.client_state['@type']).toBe(
        '/ibc.lightclients.tendermint.v1.ClientState',
      );
      expect(res.client_state.chain_id).toBe('test-2');
    });

    test('stargate query ibc consensus state should work', async () => {
      const first = await querySmart({
        ibc_consensus_state: {
          client_id: '07-tendermint-1',
          revision_number: 0,
          revision_height: 0,
          latest_height: true,
        },
      });
      const res = JSON.parse(first);
      expect(res.consensus_state['@type']).toBe(
        '/ibc.lightclients.tendermint.v1.ConsensusState',
      );
      expect(+res.proof_height.revision_height).toBeGreaterThan(0);
    });

    test('stargate query ibc connection should work', async () => {
      const first = await querySmart({
        ibc_connection: {
          connection_id: 'connection-0',
        },
      });
      const res = JSON.parse(first);
      expect(res.connection.client_id).toBe('07-tendermint-1');
      expect(+res.proof_height.revision_height).toBeGreaterThan(0);
    });

    test('stargate query tokenfactory params should work', async () => {
      const first = await querySmart({ tokenfactory_params: {} });
      const res = JSON.parse(first);
      expect(res.params.denom_creation_fee[0].denom).toBe('untrn');
      expect(res.params.denom_creation_fee[0].amount).toBe('1000000');
    });

    test('stargate query tokenfactory denom authority metadata should work', async () => {
      const first = await querySmart({
        tokenfactory_denom_authority_metadata: {
          denom: newTokenDenom,
        },
      });
      expect(first).toBe(`{"authority_metadata":{"Admin":""}}`);
    });

    test('stargate query denoms from creator should work', async () => {
      const first = await querySmart({
        tokenfactory_denoms_from_creator: {
          creator: neutronAccount.wallet.address.toString(),
        },
      });
      expect(first).toBe(`{"denoms":["${newTokenDenom}"]}`);
    });

    test('stargate query contractmanager address failures should work', async () => {
      const first = await querySmart({
        contractmanager_address_failures: {
          address: neutronAccount.wallet.address.toString(),
        },
      });
      const res = JSON.parse(first);
      expect(res.failures).toEqual([]);
    });

    test('stargate query contractmanager failures should work', async () => {
      const first = await querySmart({
        contractmanager_failures: {
          address: neutronAccount.wallet.address.toString(),
        },
      });
      const res = JSON.parse(first);
      expect(res.failures).toEqual([]);
    });

    test('stargate query interchaintx params should work', async () => {
      const first = await querySmart({ interchaintx_params: {} });
      const res = JSON.parse(first);
      expect(+res.params.msg_submit_tx_max_messages).toBeGreaterThan(0);
    });

    test('stargate query interchainqueries params should work', async () => {
      const first = await querySmart({ interchainqueries_params: {} });
      const res = JSON.parse(first);
      expect(+res.params.query_submit_timeout).toBeGreaterThan(0);
    });

    test('stargate query feeburner params should work', async () => {
      const first = await querySmart({ feeburner_params: {} });
      const res = JSON.parse(first);
      expect(res.params.neutron_denom).toBe('untrn');
    });
  });
});
