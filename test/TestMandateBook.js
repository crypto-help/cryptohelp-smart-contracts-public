const Trade = artifacts.require('./Trade'); // MandateBook
const MockedTrade = artifacts.require('./MockedTrade');
const ERC20 = artifacts.require('./MockERC20');
const _require = require("app-root-path").require;
const BlockchainCaller = _require("/utils/blockchain_caller");

const chain = new BlockchainCaller(web3);
const { BN, toBN, toChecksumAddress } = web3.utils;
require("chai").use(require("chai-bn")(BN)).should();

const {
  constants,
  expectEvent,
  expectRevert,
} = require("@openzeppelin/test-helpers");

const {
  testReject,
  timeTravelTo,
  timeTravelToBlock
} = require("./helper");

function toWei(x) {
  return web3.utils.toWei(toBN(x) /*, "nano"*/);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

contract('MandateBook', (accounts) => {

  const OWNER = accounts[0];
  const INVESTOR1 = accounts[1];
  const INVESTOR2 = accounts[2];
  const MANAGER1 = accounts[3];
  const MANAGER2 = accounts[4];
  const OUTSIDER = accounts[5];
  const MINTER = accounts[6];

//  enum AgreementLifeCycle {
  const A_EMPTY = 0; // newly created and unfilled with data
  const A_POPULATED = 1; // filled with data
  const A_PUBLISHED = 2; // terms are solidified and Investors may now commit capital, TODO discuss rollback for the future
  const A_ACTIVE = 3; // trading may happen during this phase; no status transition backwards allowed
  const A_STOPPEDOUT = 4; //RESERVED
  const A_CLOSEDINPROFIT = 5; // the Agreement has been  prematurely closed by Manager in profit
  const A_EXPIRED = 6; //the ACTIVE period has been over now
  const A_SETTLED = 7;// All Investors and a Manager have withdrawn their yields / collateral

  const DURATION1 = /* toBN(10 * 60); */ 600;
  const HALFDURATION1 = /* toBN(5 * 60); */ 300;
  const OPENPERIOD1 = /* toBN(8 * 60); */ 480;
  const HALFOPENPERIOD1 = /* toBN(4 * 60); */ 240;

  let mandateBook;
  let iA;
  let txA;

  let bPound, bYen, bHryvna;

  before('setup', async () => {
    mandateBook = await Trade.deployed(); // MandateBook

    // deploy a couple of funny stablecoins to use as capital and collateral
    bPound = await ERC20.new('BPound', 'bLBP', toWei(100_000_000), {from: MINTER});
    bYen = await ERC20.new('BYen', 'bY', toWei(500_000), {from: MINTER});
    bHryvna = await ERC20.new('BHryvna', 'bUAH', toWei(250_000), {from: MINTER});

    await bPound.transfer(MANAGER1, toWei(500_000), {from:MINTER});
    await bPound.transfer(INVESTOR1, toWei(150_000), {from:MINTER});
    await bPound.transfer(INVESTOR2, toWei(200_000), {from:MINTER});


  });

  afterEach('revert', async () => {
    //
  });

/* -------------------------
-------------------------
-------------------------
-------------------------
*/

  describe('Agreement Creation Phase', async () => {
    it('Manager should be able to create an Agreement with basic terms', async () => {
      //let's have MANAGER1 allow some coins for the MandateBook
      await bPound.approve(mandateBook.address, toWei(70_000), {from:MANAGER1});

      txA = await mandateBook.createAgreement(
        bPound.address, /* USDT testnet for example TODO change for own mock */
        30, /* targetReturnRate */
        80, /* maxCollateralRateIfAvailable */
        toWei(100_000), /* collatAmount */
        toBN(OPENPERIOD1), /* open period */ 
        toBN(DURATION1),  /* duration   */
        true,
        {from:MANAGER1});
      agreementId = txA.receipt.logs[0].args[0];
      });

    it('.. even with insufficient amount ..', async () => {
      (await mandateBook.getAgreementCollateral(agreementId)).should.be.bignumber.eq(toWei(70_000));
    });


    it('.. emitting the CreateAgreement event', async () => {
      expectEvent(txA, 'CreateAgreement', 
      {
        agreementId: agreementId,
        manager: toChecksumAddress(MANAGER1),
        baseCoin: bPound.address,
        targetReturnRate: toBN(30),
        maxCollateralRateIfAvailable: toBN(80),
        __collatAmount: toWei(70_000),      
      //  __committedCapital: toBN(0),        
        openPeriod: toBN(OPENPERIOD1),
        activePeriod: toBN(DURATION1)       
       // publishTimestamp: toBN(0) 
      });
    });
    it('.. if the collateral allowance is not approved in the baseCoin ERC20, the Agreement should still be created ..');
    it('.. and the contract should try take maximum allowance .. ');
    it('.. and the event PendingCollateral to be emitted indicating the remaining amount');

    it('Manager should be able to make more deposits of collateral in stablecoin to an Agreement, for example one with sufficient allowance', async () => {
      //let's approve some more funds and try to deposit twice
      await bPound.approve(mandateBook.address, toWei(150_000), {from:MANAGER1});
    });
    it('and one more with insufficient allowance of 50_000', async () => {
      //additional 100_000 collateral commitment this time
      await mandateBook.depositCollateral(agreementId, toWei(100_000), {from:MANAGER1});
      //Manager will try to put 100_000, out of which 50_000 pass through
    });
    it('.. thus the total collateral should end up being 70k+100k+50K = 220k', async () => {
      await mandateBook.depositCollateral(agreementId, toWei(100_000), {from:MANAGER1});
      (await mandateBook.getAgreementCollateral(agreementId)).should.be.bignumber.eq(toWei(220_000));
    }); 
        
    it('Manager should be able to (re)populate an Agreement with terms/edit');
    it('.. whereas if the new collateral value is reduced, the collateral difference is being returned back on Manager ERC20 coin address');
    it('Manager should be able to set Agreement as published', async () => {
      txPublish = await mandateBook.publishAgreement(agreementId, {from: MANAGER1});

    });
    it('.. emitting PublishAgreement Event', async () => {
     var theblock = await web3.eth.getBlock(txPublish.blockNumber/*.toString*/);
     // await web3.eth.getBlockNumber();  
     
      expectEvent(txPublish, 'PublishAgreement',
      {
        agreementId: agreementId,
        manager: toChecksumAddress(MANAGER1),
        // baseCoin: toChecksumAddress(base1),
        baseCoin: bPound.address,
        targetReturnRate: toBN(30),
        maxCollateralRateIfAvailable: toBN(80),
       __collatAmount: toWei(220_000),
       //toBN(0),
        // __committedCapital: toBN(0),        
        /*openPeriod: toBN(7 * 24 * 3600),
        activePeriod: toBN(30 * 24 * 3600),*/
        openPeriod: toBN(OPENPERIOD1),
        activePeriod: toBN(DURATION1),  
        publishTimestamp: (theblock.timestamp).toString()
      });

    });
   

   });

  describe('Agreement Acceptance Phase', async () =>{
    it('Investors should be able to opt-in to the Agreement by depositing Capital in Stablecoins', async () => {
      //let's have IVNESTOR1 and INVEESTOR2 commit to Agreement 
      await bPound.approve(mandateBook.address, toWei(30_000), {from: INVESTOR1});
      //let's make a commitment with the capital exceeding allowance, where expected is our algorithm will max at the allowance
      await mandateBook.commitToAgreement(agreementId, toWei(1_200_000), toWei(0), {from: INVESTOR1});
      //now let's introduce 1 more investor
      await bPound.approve(mandateBook.address, toWei(10_000), {from: INVESTOR2});
      await mandateBook.commitToAgreement(agreementId, toWei(5_000), toWei(0), {from: INVESTOR2});
      (await mandateBook.getAgreementCommittedCapital(agreementId)).should.be.bignumber.eq(toWei(35_000));
      //await sleep((OPENPERIOD1 + 1) * 1000);
      await timeTravelTo(OPENPERIOD1);

    });
    it('.. in which case the Mandate is populated with the terms');
    it('Investor should be able to opt-out and withdraw Capital only before the end of Open Period of the Agreement');
    it('.. in which case the Mandate is being deleted');
    it('Investor should be able to opt-in to the Agreement by more than one Mandate depositing Capital in Stablecoins');
    it('.. in which case the new Mandate is populated with the new terms based on the FCFS collateral coverage principle');
    it('Manager cannot change the terms or decrease collateral on the Agreement');
    it('Manager should be able to withdraw the Agreement whatsoever');
    it('.. in which case Investors can withdraw their Committed Capital');
    // FTF
    // it('ability to set the limit on capital accepted');
  });

  describe('Agreement Trading Phase', async () => {
    it('Right after the Open Period is over, Manager should be able to ONLY ONCE Start Agreement', async () => {
      await mandateBook.activateAgreement(agreementId, {from: MANAGER1});
      (await mandateBook.getAgreementStatus(agreementId, {from: OUTSIDER})).should.be.bignumber.eq(toBN(A_ACTIVE));
    });
    it('The Agreement should remain active throughout the DURATION', async () => {
      await timeTravelTo(HALFDURATION1);
      //await sleep(HALFDURATION1 * 1000);
      //TODO check if it reverts if we try to close or settle
    });
    it('FUTURE: Right after the Open Period is over, Manager should be able to ONLY  ONCE Cancel Agreement upon his discretion, for example if not enough Capital was committed');
    it('Manager should be able to trade with Capital on UniSwap');
  });

  describe('FUTURE: Stopped Out Case', async () => {
    it('Investor should NOT be able to close the Mandate and withdraw the collateral assigned to Mandate');
  });
  describe('FUTURE: Closed In Profit Case', async () => {
    it('Should the settlement happen earlier by the Manager initiative?');
  });
  describe('Settlement by Expiry Phase', async () => {
    //this should be enough for get outside of DURATION
    //await(HALFDURATION1+2000); //will be total duration plus 2 seconds
    it('Anyone can trigger the expiry of the contract and start settlement', async () => {
      await timeTravelTo(HALFDURATION1 + 100);
      await mandateBook.setExpiredAgreement(agreementId);
      (await mandateBook.getAgreementStatus(agreementId)).should.be.bignumber.eq(toBN(A_EXPIRED));
    });
    it('Mandate Agreement Manager or Mandate Investor should be able to settle the Mandate', async () => {
      let finalBal = toWei(35_000);
      
      inv1PreBal = await bPound.balanceOf(INVESTOR1);
      mgr1PreBal = await bPound.balanceOf(MANAGER1);
      await mandateBook.settleMandate(toBN(0), /* toWei(35_000) ,*/ {from: INVESTOR1});
      inv1EndBalShouldBe = toWei(150_000 /* initial balance */- 30_000 /* what he put in */+ 39_000); // 30_000 X 130%
      mgr1EndBalShouldBe = toWei(500_000 - (70_000 + 100_000 + 50_000) + (80 * 30_000 / 100) /* that's how much collateral was allocated to the mandate */ - (39_000 - 30_000) /* this is the lack of profit that has to be compensated */);
      (await bPound.balanceOf(INVESTOR1)).should.be.bignumber.eq(inv1EndBalShouldBe);
      (await bPound.balanceOf(MANAGER1)).should.be.bignumber.eq(mgr1EndBalShouldBe);

    });
  });


    /* ------------------------- */
  //   let tx;

  //   it('Investor should be able to create a Mandate', async () => {
  //     /* first transaction to have zero index */
  //     tx = await mandateBook.createMandate(
  //       MANAGER1 /* investor */, 
  //       0 /* TODO set nonzero duration later */, 
  //       30/* takeProfit */, 
  //       20/* stopLoss */, 
  //       {from:INVESTOR1})
  //     });

  //   it('.. emitting the CreateMandate event', async () => {
  //     expectEvent(tx, 'CreateMandate', {id: toBN(0), ethers: toBN(0), investor: INVESTOR1, manager: MANAGER1, duration: toBN(0), takeProfit: toBN(30), stopLoss: toBN(20)})
  //   });
  // });
  describe('Access Violations Checks', async () => {});
  describe("Method withdrawManagerCollateral(uint256 agreementID", async () => {
    before(async () => {
      mockedTrade = await MockedTrade.deployed();
      depositCollateralAmount = toWei(200_000);
      agreementIncome = toWei(300_000);
      commitAmount = toWei(70_000);
      targetReturnRate = 30;
      maxCollateralRateIfAvailable = 80;
      minCollatRateRequirement = 0;

      await bPound.transfer(MANAGER1, depositCollateralAmount, { from: MINTER });
      await bPound.approve(mockedTrade.address, depositCollateralAmount, { from: MANAGER1 });
      tx = await mockedTrade.createAgreement(
        bPound.address,
        targetReturnRate,
        maxCollateralRateIfAvailable,
        depositCollateralAmount,
        toBN(OPENPERIOD1),
        toBN(DURATION1),
        true,
        { from : MANAGER1 }
      );
      agreementId = tx.receipt.logs[0].args[0];
      agreement = await mockedTrade.getAgreement(agreementId);
      tx = await mockedTrade.publishAgreement(agreementId, {from: MANAGER1});

      await bPound.transfer(INVESTOR1, commitAmount, { from: MINTER });
      await bPound.approve(mockedTrade.address, commitAmount, { from: INVESTOR1 });
      res = await mockedTrade.commitToAgreement(
        agreementId,
        commitAmount,
        minCollatRateRequirement,
        { from: INVESTOR1 }
      );
      mandateId = res.logs[0].args.mandateID;
      await timeTravelTo(OPENPERIOD1);
      await mockedTrade.activateAgreement(agreementId, { from: MANAGER1 });
      await bPound.transfer(MANAGER1, agreementIncome, { from: MINTER });
      await bPound.approve(mockedTrade.address, agreementIncome, { from: MANAGER1 });
      await mockedTrade.increaseAgreementIncome(agreementId, agreementIncome, { from: MANAGER1 });
      await timeTravelTo(HALFDURATION1 + 1000);
    });
    describe("When invalid agreement", async () => {
      testReject(
        () => mockedTrade.withdrawManagerCollateral(agreementId + 1, { from: MANAGER1 }),
        "Agreement not exist"
      );
    });
    describe("When invalid caller", async () => {
      testReject(
        () => mockedTrade.withdrawManagerCollateral(agreementId, { from: MANAGER2 }),
        "Only appointed Fund Manager"
      );
    });
    describe("When agreement not expired", async () => {
      testReject(
        () => mockedTrade.withdrawManagerCollateral(agreementId, { from: MANAGER1 }),
        "Agreement should be in EXPIRED status"
      );
    });
    describe("When all conditions are good", async () => {
      before(async () => {
        hundred = toBN(100);
        await mockedTrade.setExpiredAgreement(agreementId, { from: MANAGER1 });
        balance = await mockedTrade.balances(agreementId);
        managerBalanceBefore = await bPound.balanceOf(MANAGER1);
      });
      it("should success", async () => {
        result = await mockedTrade.withdrawManagerCollateral(agreementId, { from: MANAGER1 });
        agreement = await mockedTrade.getAgreement(agreementId);
      });
      it("should increase manager balance for expected amount", async () => {
        committedCapital = toBN(agreement.__committedCapital);
        targetReturnRate = toBN(agreement.targetReturnRate);
        expectedWithdrawnAmount = balance.sub(committedCapital.div(hundred).mul(hundred.add(targetReturnRate))).add(
          depositCollateralAmount);
        managerBalance = await bPound.balanceOf(MANAGER1);
        assert.strictEqual(
          managerBalance.toString(10),
          managerBalanceBefore.add(expectedWithdrawnAmount).toString(10)
        );
      });
      it("should change agreement status to expected", () => {
        assert.strictEqual(agreement.status, '7');
      });
      describe('should emit event', async () => {
        before(() => {
          event_ = result.logs[0];
        });
        it('should event `name` be equal to expected', () => {
          assert.strictEqual(event_.event, 'ManagerCollateralWithdrawn');
        });
        it('should `agreementID` field be equal to expected', () => {
          assert.strictEqual(event_.args[0].toString(10), agreementId.toString(10));
        });
        it('should `manager` field be equal to expected', () => {
          assert.strictEqual(event_.args[1], MANAGER1);
        });
        it('should `amount` field be equal to expected', () => {
          assert.strictEqual(event_.args[2].toString(10), expectedWithdrawnAmount.toString(10));
        });
      });
    });

  });
  describe('Method withdrawCollateral(uint256 agreementID, uint256 amount)', async () => {
    before(async () => {
      amountToCollat = toWei(50);
      withdrawAmount = toWei(10);
      targetReturnRate = 30;
      maxCollateralRateIfAvailable = 80;

      await bPound.approve(mandateBook.address, amountToCollat.mul(new BN(2)), { from: MANAGER1 });

      agreementIds = [];
      for (let i = 0; i < 2; i++) {
        tx = await mandateBook.createAgreement(
          bPound.address,
          targetReturnRate,
          maxCollateralRateIfAvailable,
          amountToCollat,
          toBN(OPENPERIOD1),
          toBN(DURATION1),
          true,
          { from : MANAGER1 }
        );
        agreementIds.push(tx.receipt.logs[0].args[0]);
      }
      [agreementIdForNegativeCases, agreementIdForPositiveCases] = agreementIds;
      agreement = await mandateBook.getAgreement(agreementIdForNegativeCases);
    });
    describe('When invalid agreementId', async () => {
      testReject(
        () => mandateBook.withdrawCollateral(
          agreementIdForNegativeCases.add(new BN(100)),
          withdrawAmount,
          { from: MANAGER1 }
        ),
        "Agreement not exist"
      );
    });
    describe('When caller is not manager of agreement', async () => {
      testReject(
        () => mandateBook.withdrawCollateral(agreementIdForNegativeCases, withdrawAmount, { from: MANAGER2 }),
        "Only appointed Fund Manager"
      );
    });
    describe('When withdraw amount is not positive', async () => {
      testReject(
        () => mandateBook.withdrawCollateral(agreementIdForNegativeCases, 0, { from: MANAGER1 }),
        "Amount should be positive"
      );
    });
    describe('When withdraw amount is more than agreement free collateral amount', async () => {
      testReject(
        () => mandateBook.withdrawCollateral(
          agreementIdForNegativeCases,
          amountToCollat.add(new BN(1)),
          { from: MANAGER1 }
        ),
        "Not enough free collateral amount"
      );
    });
    describe('When agreement state is more than POPULATED', async () => {
      before(async () => {
        await mandateBook.publishAgreement(
          agreementIdForNegativeCases,
          { from: MANAGER1 }
        );
        agreement = await mandateBook.getAgreement(agreementIdForNegativeCases);
      });
      it("should agreement status be equal to expected", () => assert.strictEqual(
        agreement.status, '2'
      ));
      testReject(
        () => mandateBook.withdrawCollateral(agreementIdForNegativeCases, withdrawAmount, { from: MANAGER1 }),
        "Can't withdraw collateral at this stage"
      )
    });
    describe('When all conditions are good', async () => {
      before(async () => {
        agreement = await mandateBook.getAgreement(agreementIdForPositiveCases);
        collatAmountBefore = new BN(agreement.__collatAmount);
        freeCollatAmountBefore = new BN(agreement.__freeCollatAmount);
        balanceBefore = await bPound.balanceOf(MANAGER1);
      });
      it('should success', async () => {
        result = await mandateBook.withdrawCollateral(agreementIdForPositiveCases, withdrawAmount, { from: MANAGER1 });
        agreement = await mandateBook.getAgreement(agreementIdForPositiveCases);
      });
      it('should update `__collatAmount` in agreement object', () => {
        collatAmountAfter = agreement.__collatAmount;
        assert.strictEqual(collatAmountAfter.toString(10), collatAmountBefore.sub(withdrawAmount).toString(10));
      });
      it('should update `__freeCollatAmount` in agreement object', () => {
        freeCollatAmountAfter = agreement.__freeCollatAmount;
        assert.strictEqual(freeCollatAmountAfter.toString(10), freeCollatAmountBefore.sub(withdrawAmount).toString(10));
      });
      it('should increase manger balance', async () => {
        balanceAfter = await bPound.balanceOf(MANAGER1);
        assert.strictEqual(balanceAfter.toString(10), balanceBefore.add(withdrawAmount).toString(10));
      });
      describe('should emit event', async () => {
        before(() => {
          event_ = result.logs[0];
        });
        it('should event `name` be equal to expected', () => {
          assert.strictEqual(event_.event, 'WithdrawCollateral');
        });
        it('should `agreementID` field be equal to expected', () => {
          assert.strictEqual(event_.args[0].toString(10), agreementIdForPositiveCases.toString(10));
        });
        it('should `manager` field be equal to expected', () => {
          assert.strictEqual(event_.args[1], MANAGER1);
        });
        it('should `amount` field be equal to expected', () => {
          assert.strictEqual(event_.args[2].toString(10), withdrawAmount.toString(10));
        });
      });
    });
  });
  describe("Method deleteAgreement(uint256 agreementId)", () => {
    before(async () => {
      mockedTrade = await MockedTrade.deployed();
      depositCollateralAmount = toWei(200_000);
      agreementIncome = toWei(300_000);
      commitAmount = toWei(70_000);
      targetReturnRate = 30;
      maxCollateralRateIfAvailable = 80;
      minCollatRateRequirement = 0;

      await bPound.transfer(MANAGER1, depositCollateralAmount, { from: MINTER });
      await bPound.approve(mockedTrade.address, depositCollateralAmount, { from: MANAGER1 });
      tx = await mockedTrade.createAgreement(
        bPound.address,
        targetReturnRate,
        maxCollateralRateIfAvailable,
        depositCollateralAmount,
        toBN(OPENPERIOD1),
        toBN(DURATION1),
        true,
        { from : MANAGER1 }
      );
      agreementId = tx.receipt.logs[0].args[0];
      balanceBefore = await bPound.balanceOf(MANAGER1);
      contractBalanceBefore = await bPound.balanceOf(mockedTrade.address);
      contractCollateral = await mockedTrade.getAgreement(agreementId).then(agreement => new BN(agreement.__collatAmount));
    });
    describe("When agreement does not exist", () => {
      testReject(
        () => mockedTrade.deleteAgreement(agreementId + 1, { from: MANAGER1 }),
        "Agreement not exist"
      );
    });
    describe("When caller is not agreement manager", () => {
      testReject(
        () => mockedTrade.deleteAgreement(agreementId, { from: MANAGER2 }),
        "Only appointed Fund Manager"
      );
    });
    describe("When agreement status is published", () => {
      before(() => mockedTrade.publishAgreement(agreementId, { from: MANAGER1 }));
      testReject(
        () => mockedTrade.deleteAgreement(agreementId, { from: MANAGER1 }),
        "Agreement status should be less than PUBLISHED"
      );
    });
    describe("When agreement status is populated", () => {
      before(() => mockedTrade.unpublishAgreement(agreementId, { from: MANAGER1 }));
      it("should success", async () => {
        result = await mockedTrade.deleteAgreement(agreementId, { from: MANAGER1 });
        agreement = await mockedTrade.getAgreement(agreementId);
      });
      it("should update agreement 'isDeleted' field to expected", () => assert.strictEqual(agreement.isDeleted, true));
      it("should decrease agreement collateral amount", () => assert.strictEqual(new BN(agreement.__collatAmount).toString(10), "0"));
      it("should increase agreement manager balance to expected", async () => {
        const balance = await bPound.balanceOf(MANAGER1);
        assert.strictEqual(
          balance.toString(10),
          balanceBefore.add(contractCollateral).toString(10)
        );
      });
      it("should decrease contract balance to expected", async () => {
        const contractBalance = await bPound.balanceOf(mockedTrade.address);
        assert.strictEqual(
          contractBalance.toString(10),
          contractBalanceBefore.sub(contractCollateral).toString(10)
        );
      });
      it("should emit event with name equal to expected", () => assert.strictEqual(result.logs[0].event, "DeleteAgreement"));
      it(
        "should emit event with 'agreementId' field equal to expected",
        () => assert.strictEqual(result.logs[0].args[0].toString(10), agreementId.toString(10))
      );
    });
    describe("When agreement already deleted", () => {
      describe("When try to delete agreement", () => {
        testReject(
          () => mockedTrade.deleteAgreement(agreementId, { from: MANAGER1 }),
          "Agreement already deleted"
        );
      });
      describe("When try to populate agreement", () => {
        testReject(
          () => mockedTrade.populateAgreement(agreementId, agreement.baseCoin, 1, 1, 1, 1, 1, true, { from: MANAGER1 }),
          "Agreement already deleted"
        );
      });
      describe("When try to deposit collateral", () => {
        testReject(
          () => mockedTrade.depositCollateral(agreementId, 50, { from: MANAGER1 }),
          "Agreement already deleted"
        );
      });
      describe("When try to publish agreement", () => {
        testReject(
          () => mockedTrade.publishAgreement(agreementId, { from: MANAGER1 }),
          "Agreement already deleted"
        );
      });
      describe("When try to publish agreement", () => {
        testReject(
          () => mockedTrade.setExpiredAgreement(agreementId, { from: MANAGER1 }),
          "Agreement already deleted"
        );
      });
    });
  });
  describe(
    "Method commitToAgreement(uint256 agreementId, uint256 amount, uint256 minCollatRateRequirement): uint256",
    () => {
      before(async () => {
        mockedTrade = await MockedTrade.deployed();
        depositCollateralAmount = toWei(200_000);
        agreementIncome = toWei(300_000);
        commitAmount = toWei(70_000);
        targetReturnRate = 30;
        maxCollateralRateIfAvailable = 80;
      });
      describe("When agreement 'canInvestMoreThanCollateral' is false", () => {
        before(async () => {
          await bPound.transfer(MANAGER1, depositCollateralAmount, { from: MINTER });
          await bPound.approve(mockedTrade.address, depositCollateralAmount, { from: MANAGER1 });
          tx = await mockedTrade.createAgreement(
            bPound.address,
            targetReturnRate,
            maxCollateralRateIfAvailable,
            depositCollateralAmount,
            toBN(OPENPERIOD1),
            toBN(DURATION1),
            false,
            { from : MANAGER1 }
          );
          agreementId = tx.receipt.logs[0].args[0];
          agreement = await mockedTrade.getAgreement(agreementId);
          await mockedTrade.publishAgreement(agreementId, {from: MANAGER1});
          await bPound.transfer(INVESTOR1, commitAmount, { from: MINTER });
          await bPound.approve(mockedTrade.address, commitAmount, { from: INVESTOR1 });
        });
        describe("When min required collateral rate not positive", () => {
          testReject(
            () => mockedTrade.commitToAgreement(agreementId, commitAmount, 0, { from: INVESTOR1 }),
            "Min required collateral rate must be positive"
          );
        });
        describe("When min required collateral rate positive", () => {
          it(
            "should success",
            () => mockedTrade.commitToAgreement(
              agreementId,
              commitAmount,
              maxCollateralRateIfAvailable,
              { from: INVESTOR1 }
            )
          );
        });
      });
      describe("When agreement 'canInvestMoreThanCollateral' is true", () => {
        before(async () => {
          await bPound.transfer(MANAGER1, depositCollateralAmount, { from: MINTER });
          await bPound.approve(mockedTrade.address, depositCollateralAmount, { from: MANAGER1 });
          tx = await mockedTrade.createAgreement(
            bPound.address,
            targetReturnRate,
            maxCollateralRateIfAvailable,
            depositCollateralAmount,
            toBN(OPENPERIOD1),
            toBN(DURATION1),
            true,
            { from : MANAGER1 }
          );
          agreementId = tx.receipt.logs[0].args[0];
          agreement = await mockedTrade.getAgreement(agreementId);
          await mockedTrade.publishAgreement(agreementId, {from: MANAGER1});
          await bPound.transfer(INVESTOR1, commitAmount.mul(new BN(2)), { from: MINTER });
          await bPound.approve(mockedTrade.address, commitAmount.mul(new BN(2)), { from: INVESTOR1 });
        });
        describe("When min required collateral rate not positive", () => {
          it(
            "should success",
            () => mockedTrade.commitToAgreement(
              agreementId,
              commitAmount,
              0,
              { from: INVESTOR1 }
            )
          );
        });
        describe("When min required collateral rate positive", () => {
          it(
            "should success",
            () => mockedTrade.commitToAgreement(
              agreementId,
              commitAmount,
              maxCollateralRateIfAvailable,
              { from: INVESTOR1 }
            )
          );
        });
      });
  });
  describe("Method withdrawCapital(uint256 mandateId, uint256 amount)", () => {
    before(async () => {
      mockedTrade = await MockedTrade.deployed();
      depositCollateralAmount = toWei(200_000);
      agreementIncome = toWei(300_000);
      commitAmount = toWei(70_000);
      withdrawAmount = commitAmount.sub(new BN(2));
      targetReturnRate = 30;
      maxCollateralRateIfAvailable = 80;
    });
    before(async () => {
      await bPound.transfer(MANAGER1, depositCollateralAmount, { from: MINTER });
      await bPound.approve(mockedTrade.address, depositCollateralAmount, { from: MANAGER1 });
      tx = await mockedTrade.createAgreement(
        bPound.address,
        targetReturnRate,
        maxCollateralRateIfAvailable,
        depositCollateralAmount,
        toBN(OPENPERIOD1),
        toBN(DURATION1),
        false,
        { from : MANAGER1 }
      );
      agreementId = tx.receipt.logs[0].args[0];
      await mockedTrade.publishAgreement(agreementId, {from: MANAGER1});
      await bPound.transfer(INVESTOR1, commitAmount, { from: MINTER });
      await bPound.approve(mockedTrade.address, commitAmount, { from: INVESTOR1 });
      tx = await mockedTrade.commitToAgreement(
        agreementId,
        commitAmount,
        maxCollateralRateIfAvailable,
        { from: INVESTOR1 }
      );
      mandateId = tx.logs[0].args.mandateId;
    });
    describe("When mandate not exist", () => {
      testReject(
        () => mockedTrade.withdrawCapital(mandateId.add(new BN(1)), commitAmount, { from: INVESTOR1 }),
        "Mandate not exist"
      );
    });
    describe("When caller is not mandate investor", () => {
      testReject(
        () => mockedTrade.withdrawCapital(mandateId, commitAmount, { from: MINTER }),
        "Only Mandate Investor"
      );
    });
    describe("When agreement in active status", () => {
      before(async () => {
        await bPound.transfer(MANAGER1, depositCollateralAmount, { from: MINTER });
        await bPound.approve(mockedTrade.address, depositCollateralAmount, { from: MANAGER1 });
        txActive = await mockedTrade.createAgreement(
          bPound.address,
          targetReturnRate,
          maxCollateralRateIfAvailable,
          depositCollateralAmount,
          toBN(OPENPERIOD1),
          toBN(DURATION1),
          false,
          { from : MANAGER1 }
        );
        agreementIdActive = txActive.receipt.logs[0].args[0];
        await mockedTrade.publishAgreement(agreementIdActive, {from: MANAGER1});
        await bPound.transfer(INVESTOR1, commitAmount, { from: MINTER });
        await bPound.approve(mockedTrade.address, commitAmount, { from: INVESTOR1 });
        txActive = await mockedTrade.commitToAgreement(
          agreementIdActive,
          commitAmount,
          maxCollateralRateIfAvailable,
          { from: INVESTOR1 }
        );
        mandateIdActive = txActive.logs[0].args.mandateId;
        await mockedTrade.activateAgreement(agreementIdActive, { from: MANAGER1 });
      });
      testReject(
        () => mockedTrade.withdrawCapital(mandateIdActive, commitAmount, { from: INVESTOR1 }),
        "Can't withdraw from agreement at this stage"
      );
    });
    describe("When withdraw amount more than commitAmount", () => {
      testReject(
        () => mockedTrade.withdrawCapital(mandateId, commitAmount.add(new BN(1)), { from: INVESTOR1 }),
        "Can't withdraw more than you have"
      );
    });
    describe("When withdraw amount less than commitAmount", () => {
      before(async () => {
        investorBalanceBefore = await bPound.balanceOf(INVESTOR1);
        mandateBefore = await mockedTrade.getMandate(mandateId);
        agreementBefore = await mockedTrade.getAgreement(agreementId);
        collatToRelease = new BN(mandateBefore.__collatAmount)
          .mul(withdrawAmount)
          .div(new BN(mandateBefore.__committedCapital));
      });
      it("should success", async () => {
        result = await mockedTrade.withdrawCapital(mandateId, withdrawAmount, { from: INVESTOR1 });
      });
      it("should increase investor balance to expected", async () => {
        investorBalance = await bPound.balanceOf(INVESTOR1);
        assert.strictEqual(
          investorBalance.toString(10),
          investorBalanceBefore.add(withdrawAmount).toString(10)
        );
      });
      describe("Check mandate object changes", () => {
        before(async () => {
          mandate = await mockedTrade.getMandate(mandateId);
        });
        it("should decrease '__commitedCapital' field to expected", () => assert.strictEqual(
          mandate.__committedCapital.toString(10),
          new BN(mandateBefore.__committedCapital).sub(withdrawAmount).toString(10)
        ));
        it("should decrease '__collatAmount' field to expected", () => assert.strictEqual(
          mandate.__collatAmount.toString(10),
          new BN(mandateBefore.__collatAmount).sub(collatToRelease).toString(10)
        ));
      });
      describe("Check agreement object changes", () => {
        before(async () => {
          agreement = await mockedTrade.getAgreement(agreementId);
        });
        it("should decrease '__commitedCapital' field to expected", () => assert.strictEqual(
          agreement.__committedCapital.toString(10),
          new BN(agreementBefore.__committedCapital).sub(withdrawAmount).toString(10)
        ));
        it("should increase '__freeCollatAmount' field to expected", () =>  assert.strictEqual(
          agreement.__freeCollatAmount.toString(10),
          new BN(agreementBefore.__freeCollatAmount).add(collatToRelease).toString(10)
        ));
      });
      describe("should emit event", () => {
        before(() => {
          event_ = result.logs[0];
        });
        it('should event `name` be equal to expected', () => {
          assert.strictEqual(event_.event, 'WithdrawCapital');
        });
        it('should `agreementId` field be equal to expected', () => {
          assert.strictEqual(event_.args[0].toString(10), agreementId.toString(10));
        });
        it('should `manager` field be equal to expected', () => {
          assert.strictEqual(event_.args[1], MANAGER1);
        });
        it('should `mandateId` field be equal to expected', () => {
          assert.strictEqual(event_.args[2].toString(10), mandateId.toString(10));
        });
        it('should `investor` field be equal to expected', () => {
          assert.strictEqual(event_.args[3], INVESTOR1);
        });
        it('should `amount` field be equal to expected', () => {
          assert.strictEqual(event_.args[4].toString(10), withdrawAmount.toString(10));
        });
      });
    });
    describe("When withdraw amount equal to commitAmount", () => {
      before(async () => {
        investorBalanceBefore = await bPound.balanceOf(INVESTOR1);
        mandateBefore = await mockedTrade.getMandate(mandateId);
        residualCommitAmount = new BN(mandateBefore.__committedCapital);
        agreementBefore = await mockedTrade.getAgreement(agreementId);
        collatToRelease = new BN(mandateBefore.__collatAmount);
      });
      it("should success", async () => {
        result = await mockedTrade.withdrawCapital(mandateId, residualCommitAmount, { from: INVESTOR1 });
      });
      it("should increase investor balance to expected", async () => {
        investorBalance = await bPound.balanceOf(INVESTOR1);
        assert.strictEqual(
          investorBalance.toString(10),
          investorBalanceBefore.add(residualCommitAmount).toString(10)
        );
      });
      describe("Check mandate object changes", () => {
        before(async () => {
          mandate = await mockedTrade.getMandate(mandateId);
        });
        it("should decrease '__commitedCapital' field to expected", () => assert.strictEqual(
          mandate.__committedCapital.toString(10),
          new BN(mandateBefore.__committedCapital).sub(residualCommitAmount).toString(10)
        ));
        it("should decrease '__collatAmount' field to expected", () => assert.strictEqual(
          mandate.__collatAmount.toString(10),
          new BN(mandateBefore.__collatAmount).sub(collatToRelease).toString(10)
        ));
      });
      describe("Check agreement object changes", () => {
        before(async () => {
          agreement = await mockedTrade.getAgreement(agreementId);
        });
        it("should decrease '__commitedCapital' field to expected", () => assert.strictEqual(
          agreement.__committedCapital.toString(10),
          new BN(agreementBefore.__committedCapital).sub(residualCommitAmount).toString(10)
        ));
        it("should increase '__freeCollatAmount' field to expected", () =>  assert.strictEqual(
          agreement.__freeCollatAmount.toString(10),
          new BN(agreementBefore.__freeCollatAmount).add(collatToRelease).toString(10)
        ));
      });
      describe("should emit events", () => {
        before(() => {
          withdrawCapitalEvent = result.logs[0];
          cancelMandateEvent = result.logs[1];
        });
        describe("Event #1", () => {
          it('should event `name` be equal to expected', () => {
            assert.strictEqual(withdrawCapitalEvent.event, 'WithdrawCapital');
          });
          it('should `agreementId` field be equal to expected', () => {
            assert.strictEqual(withdrawCapitalEvent.args[0].toString(10), agreementId.toString(10));
          });
          it('should `manager` field be equal to expected', () => {
            assert.strictEqual(withdrawCapitalEvent.args[1], MANAGER1);
          });
          it('should `mandateId` field be equal to expected', () => {
            assert.strictEqual(withdrawCapitalEvent.args[2].toString(10), mandateId.toString(10));
          });
          it('should `investor` field be equal to expected', () => {
            assert.strictEqual(withdrawCapitalEvent.args[3], INVESTOR1);
          });
          it('should `amount` field be equal to expected', () => {
            assert.strictEqual(withdrawCapitalEvent.args[4].toString(10), residualCommitAmount.toString(10));
          });
        });
        describe("Event #2", () => {
          it('should event `name` be equal to expected', () => {
            assert.strictEqual(cancelMandateEvent.event, 'CancelMandate');
          });
          it('should `agreementId` field be equal to expected', () => {
            assert.strictEqual(cancelMandateEvent.args[0].toString(10), agreementId.toString(10));
          });
          it('should `manager` field be equal to expected', () => {
            assert.strictEqual(cancelMandateEvent.args[1], MANAGER1);
          });
          it('should `mandateId` field be equal to expected', () => {
            assert.strictEqual(cancelMandateEvent.args[2].toString(10), mandateId.toString(10));
          });
          it('should `investor` field be equal to expected', () => {
            assert.strictEqual(cancelMandateEvent.args[3], INVESTOR1);
          });
        });
      });
    });
  });
})
