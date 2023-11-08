import {
  CosmosWrapper,
  NEUTRON_DENOM,
  WalletWrapper,
} from '../../helpers/cosmos';
import { TestStateLocalCosmosTestNet } from '../common_localcosmosnet';
import { getWithAttempts } from '../../helpers/wait';
import { Dao, DaoMember, getDaoContracts } from '../../helpers/dao';
import {
  updateContractmanagerParamsProposal,
  updateCronParamsProposal,
  updateFeeburnerParamsProposal,
  updateInterchainqueriesParamsProposal,
  updateInterchaintxsParamsProposal,
  updateTokenfacoryParamsProposal,
} from '../../helpers/proposal';

describe('Neutron / Parameters', () => {
  let testState: TestStateLocalCosmosTestNet;
  let neutronChain: CosmosWrapper;
  let neutronAccount: WalletWrapper;
  let daoMember1: DaoMember;
  let dao: Dao;

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
    const daoCoreAddress = (await neutronChain.getChainAdmins())[0];
    const daoContracts = await getDaoContracts(neutronChain, daoCoreAddress);
    dao = new Dao(neutronChain, daoContracts);
    daoMember1 = new DaoMember(neutronAccount, dao);
  });

  describe('prepare: bond funds', () => {
    test('bond form wallet 1', async () => {
      await daoMember1.bondFunds('1000');
      await getWithAttempts(
        neutronChain.blockWaiter,
        async () =>
          await dao.queryVotingPower(daoMember1.user.wallet.address.toString()),
        async (response) => response.power == 1000,
        20,
      );
    });
    test('check voting power', async () => {
      await getWithAttempts(
        neutronChain.blockWaiter,
        async () => await dao.queryTotalVotingPower(),
        async (response) => response.power == 1000,
        20,
      );
    });
  });

  describe('Interchain queries params proposal', () => {
    test('create proposal', async () => {
      await daoMember1.submitUpdateParamsInterchainqueriesProposal(
        'Proposal #1',
        'Param change proposal. This one will pass',
        updateInterchainqueriesParamsProposal({
          query_submit_timeout: 30,
          query_deposit: null,
          tx_query_removal_limit: 20,
        }),
        '1000',
      );
    });

    describe('vote for proposal', () => {
      const proposalId = 1;
      test('vote YES', async () => {
        await daoMember1.voteYes(proposalId);
      });
    });

    describe('execute proposal', () => {
      const proposalId = 1;
      let paramsBefore;
      test('check if proposal is passed', async () => {
        await dao.checkPassedProposal(proposalId);
      });
      test('execute passed proposal', async () => {
        paramsBefore = await neutronChain.queryInterchainqueriesParams();
        const host = await neutronChain.queryHostEnabled();
        expect(host).toEqual(true);
        await daoMember1.executeProposalWithAttempts(proposalId);
      });
      test('check if params changed after proposal execution', async () => {
        const paramsAfter = await neutronChain.queryInterchainqueriesParams();
        expect(paramsAfter.params.query_submit_timeout).not.toEqual(
          paramsBefore.params.query_submit_timeout,
        );
        expect(paramsAfter.params.tx_query_removal_limit).not.toEqual(
          paramsBefore.params.tx_query_removal_limit,
        );
        expect(paramsAfter.params.query_submit_timeout).toEqual('30');
        expect(paramsAfter.params.tx_query_removal_limit).toEqual('20');
      });
    });
  });

  describe('Tokenfactory params proposal', () => {
    test('create proposal', async () => {
      await daoMember1.submitUpdateParamsTokenfactoryProposal(
        'Proposal #2',
        'Tokenfactory params proposal',
        updateTokenfacoryParamsProposal({
          denom_creation_fee: null,
          denom_creation_gas_consume: 100000,
        }),
        '1000',
      );
    });

    describe('vote for proposal', () => {
      const proposalId = 2;
      test('vote YES', async () => {
        await daoMember1.voteYes(proposalId);
      });
    });

    describe('execute proposal', () => {
      const proposalId = 2;
      let paramsBefore;
      test('check if proposal is passed', async () => {
        await dao.checkPassedProposal(proposalId);
      });
      test('execute passed proposal', async () => {
        paramsBefore = await neutronChain.queryTokenfactoryParams();
        await daoMember1.executeProposalWithAttempts(proposalId);
      });
      test('check if params changed after proposal execution', async () => {
        const paramsAfter = await neutronChain.queryTokenfactoryParams();

        expect(paramsAfter.params.denom_creation_fee).toEqual(
          paramsBefore.params.denom_creation_fee,
        );
        expect(paramsAfter.params.denom_creation_gas_consume).not.toEqual(
          paramsBefore.params.denom_creation_gas_consume,
        );
        expect(paramsAfter.params.denom_creation_fee).toHaveLength(0);
        expect(paramsAfter.params.denom_creation_gas_consume).toEqual('100000');
      });
    });
  });

  describe('Feeburner params proposal', () => {
    test('create proposal', async () => {
      await daoMember1.submitUpdateParamsFeeburnerProposal(
        'Proposal #3',
        'Feeburner params proposal',
        updateFeeburnerParamsProposal({
          treasury_address: dao.contracts.voting.address,
        }),
        '1000',
      );
    });

    describe('vote for proposal', () => {
      const proposalId = 3;
      test('vote YES from wallet 1', async () => {
        await daoMember1.voteYes(proposalId);
      });
    });

    describe('execute proposal', () => {
      const proposalId = 3;
      let paramsBefore;
      test('check if proposal is passed', async () => {
        await dao.checkPassedProposal(proposalId);
      });
      test('execute passed proposal', async () => {
        paramsBefore = await neutronChain.queryFeeburnerParams();
        await daoMember1.executeProposalWithAttempts(proposalId);
      });
      test('check if params changed after proposal execution', async () => {
        const paramsAfter = await neutronChain.queryFeeburnerParams();
        expect(paramsAfter.params.treasury_address).not.toEqual(
          paramsBefore.params.treasury_address,
        );
        expect(paramsAfter.params.treasury_address).toEqual(
          dao.contracts.voting.address,
        );
      });
    });
  });

  describe('Feerefunder params proposal', () => {
    test('create proposal', async () => {
      await daoMember1.submitUpdateParamsFeerefunderProposal(
        'Proposal #4',
        'Feerefunder update params proposal',
        '1000',
      );
    });

    describe('vote for proposal', () => {
      const proposalId = 4;
      test('vote YES', async () => {
        await daoMember1.voteYes(proposalId);
      });
    });

    describe('execute proposal', () => {
      const proposalId = 4;
      let paramsBefore;
      test('check if proposal is passed', async () => {
        await dao.checkPassedProposal(proposalId);
      });
      test('execute passed proposal', async () => {
        paramsBefore = await neutronChain.queryFeerefunderParams();
        await daoMember1.executeProposalWithAttempts(proposalId);
      });
      test('check if params changed after proposal execution', async () => {
        const paramsAfter = await neutronChain.queryFeerefunderParams();
        expect(paramsAfter.params.min_fee.recv_fee).toEqual(
          paramsBefore.params.min_fee.recv_fee,
        );
        expect(paramsAfter.params.min_fee.ack_fee).not.toEqual(
          paramsBefore.params.min_fee.ack_fee,
        );
        expect(paramsAfter.params.min_fee.timeout_fee).not.toEqual(
          paramsBefore.params.min_fee.timeout_fee,
        );
        // toHaveLength(0) equals fee struct is '[]'
        expect(paramsAfter.params.min_fee.recv_fee).toHaveLength(0);
        expect(paramsAfter.params.min_fee.ack_fee).toHaveLength(0);
        expect(paramsAfter.params.min_fee.timeout_fee).toHaveLength(0);
      });
    });
  });

  describe('Cron params proposal', () => {
    test('create proposal', async () => {
      await daoMember1.submitUpdateParamsCronProposal(
        'Proposal #5',
        'Cron update params proposal. Will pass',
        updateCronParamsProposal({
          security_address: dao.contracts.voting.address,
          limit: 10,
        }),
        '1000',
      );
    });

    describe('vote for proposal', () => {
      const proposalId = 5;
      test('vote YES from wallet 1', async () => {
        await daoMember1.voteYes(proposalId);
      });
    });

    describe('execute proposal', () => {
      const proposalId = 5;
      let paramsBefore;
      test('check if proposal is passed', async () => {
        await dao.checkPassedProposal(proposalId);
      });
      test('execute passed proposal', async () => {
        paramsBefore = await neutronChain.queryCronParams();
        await daoMember1.executeProposalWithAttempts(proposalId);
      });
      test('check if params changed after proposal execution', async () => {
        const paramsAfter = await neutronChain.queryCronParams();
        expect(paramsAfter.params.security_address).not.toEqual(
          paramsBefore.params.security_address,
        );
        expect(paramsAfter.params.security_address).toEqual(
          dao.contracts.voting.address,
        );
      });
    });
  });

  describe('Contractanager params proposal', () => {
    test('create proposal', async () => {
      await daoMember1.submitUpdateParamsContractmanageProposal(
        'Proposal #6',
        'Contractanager params proposal',
        updateContractmanagerParamsProposal({
          sudo_call_gas_limit: '1000',
        }),
        '1000',
      );
    });

    describe('vote for proposal', () => {
      const proposalId = 6;
      test('vote YES', async () => {
        await daoMember1.voteYes(proposalId);
      });
    });

    describe('execute proposal', () => {
      const proposalId = 6;
      let paramsBefore;
      test('check if proposal is passed', async () => {
        await dao.checkPassedProposal(proposalId);
      });
      test('execute passed proposal', async () => {
        paramsBefore = await neutronChain.queryContractmanagerParams();
        await daoMember1.executeProposalWithAttempts(proposalId);
      });
      test('check if params changed after proposal execution', async () => {
        const paramsAfter = await neutronChain.queryContractmanagerParams();
        expect(paramsAfter.params.sudo_call_gas_limit).not.toEqual(
          paramsBefore.params.sudo_call_gas_limit,
        );
        expect(paramsAfter.params.sudo_call_gas_limit).toEqual('1000');
      });
    });
  });

  describe('Interchaintxs params proposal', () => {
    test('create proposal', async () => {
      await daoMember1.submitUpdateParamsInterchaintxsProposal(
        'Proposal #7',
        'Update interchaintxs params',
        updateInterchaintxsParamsProposal({
          msg_submit_tx_max_messages: 11,
        }),
        '1000',
      );
    });

    describe('vote for proposal', () => {
      const proposalId = 7;
      test('vote YES', async () => {
        await daoMember1.voteYes(proposalId);
      });
    });

    describe('execute proposal', () => {
      const proposalId = 7;
      let paramBefore;
      test('check if proposal is passed', async () => {
        await dao.checkPassedProposal(proposalId);
      });
      test('execute passed proposal', async () => {
        paramBefore = await neutronChain.queryMaxTxsAllowed();
        await daoMember1.executeProposalWithAttempts(proposalId);
      });
      test('check if params changed after proposal execution', async () => {
        const paramAfter = await neutronChain.queryMaxTxsAllowed();
        expect(paramAfter).not.toEqual(paramBefore);
        expect(paramAfter).toEqual('11');
      });
    });
  });
});
