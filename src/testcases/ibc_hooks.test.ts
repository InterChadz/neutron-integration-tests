import Long from 'long';
import {
  COSMOS_DENOM,
  CosmosWrapper,
  NEUTRON_DENOM,
  NeutronContract,
} from '../helpers/cosmos';
import { TestStateLocalCosmosTestNet } from './common_localcosmosnet';
import { getRegisteredQuery } from '../helpers/icq';

describe('Neutron / IBC hooks', () => {
  let testState: TestStateLocalCosmosTestNet;
  let ntrnDemo1: CosmosWrapper;
  let cosmosDemo2: CosmosWrapper;
  let contractAddress: string;

  beforeAll(async () => {
    testState = new TestStateLocalCosmosTestNet();
    await testState.init();
    ntrnDemo1 = new CosmosWrapper(
      testState.sdk1,
      testState.blockWaiter1,
      testState.wallets.neutron.demo1,
      NEUTRON_DENOM,
    );
    cosmosDemo2 = new CosmosWrapper(
      testState.sdk2,
      testState.blockWaiter2,
      testState.wallets.cosmos.demo2,
      COSMOS_DENOM,
    );
  });

  describe('Wallets', () => {
    test('Addresses', () => {
      expect(testState.wallets.neutron.demo1.address.toString()).toEqual(
        'neutron1m9l358xunhhwds0568za49mzhvuxx9ux8xafx2',
      );
      expect(testState.wallets.cosmos.demo2.address.toString()).toEqual(
        'cosmos10h9stc5v6ntgeygf5xf945njqq5h32r53uquvw',
      );
    });
  });

  describe('Instantiate interchain queries contract', () => {
    let codeId: string;
    test('store contract', async () => {
      codeId = await ntrnDemo1.storeWasm(NeutronContract.INTERCHAIN_QUERIES);
      expect(parseInt(codeId)).toBeGreaterThan(0);
    });
    test('instantiate contract', async () => {
      contractAddress = (
        await ntrnDemo1.instantiate(codeId, '{}', 'neutron_interchain_queries')
      )[0]._contract_address;
    });
  });

  describe('IBC Hooks', () => {
    describe('Correct way', () => {
      test('IBC transfer from a usual account', async () => {
        const res = await ntrnDemo1.msgIBCTransfer(
          'transfer',
          'channel-0',
          { denom: NEUTRON_DENOM, amount: '1000000' },
          testState.wallets.cosmos.demo2.address.toString(),
          {
            revision_number: new Long(2),
            revision_height: new Long(100000000),
          },
        );
        expect(res.code).toEqual(0);
        await ntrnDemo1.blockWaiter.waitBlocks(10);
      });

      test('check IBC token balance', async () => {
        await ntrnDemo1.blockWaiter.waitBlocks(10);
        const balances = await cosmosDemo2.queryBalances(
          testState.wallets.cosmos.demo2.address.toString(),
        );
        expect(
          balances.balances.find(
            (bal): boolean =>
              bal.denom ==
              'ibc/4E41ED8F3DCAEA15F4D6ADC6EDD7C04A676160735C9710B904B7BF53525B56D6',
          )?.amount,
        ).toEqual('1000');
      });

      test('IBC transfer of Neutrons from a remote chain to Neutron with wasm hook', async () => {
        const res = await cosmosDemo2.msgIBCTransfer(
          'transfer',
          'channel-0',
          {
            denom:
              'ibc/4E41ED8F3DCAEA15F4D6ADC6EDD7C04A676160735C9710B904B7BF53525B56D6',
            amount: '1000000',
          },
          contractAddress,
          {
            revision_number: new Long(2),
            revision_height: new Long(100000000),
          },
          `{"wasm": {"contract": "${contractAddress}", "msg": {"register_balance_query": {"connection_id": "connection-0", "denom": "untrn", "addr": "cosmos10h9stc5v6ntgeygf5xf945njqq5h32r53uquvw", "update_period": 10}}}}`,
        );
        expect(res.code).toEqual(0);
        await cosmosDemo2.blockWaiter.waitBlocks(30);
      });

      test('check hook was executed successfully', async () => {
        try {
          const queryResult = await getRegisteredQuery(
            ntrnDemo1,
            contractAddress,
            1,
          );

          expect(queryResult.registered_query.id).toEqual(1);
          expect(queryResult.registered_query.owner).toEqual(contractAddress);
        } catch (e) {
          console.log('Exception: ' + JSON.stringify(e.response.data));
          expect(e.response.data).toEqual(1);
        }
      });

      test('check contract token balance', async () => {
        await ntrnDemo1.blockWaiter.waitBlocks(10);
        const balances = await ntrnDemo1.queryBalances(contractAddress);
        console.log('Result balances: ' + JSON.stringify(balances));
        expect(
          balances.balances.find((bal): boolean => bal.denom == 'ntrn')?.amount,
        ).toEqual('1000000');
      });
    });
  });
});
