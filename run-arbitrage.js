require("dotenv").config();
const Web3 = require("web3");
const abis = require("./abis");
const { mainnet: addresses } = require("./addresses");
// const { testnet: addresses } = require("./addresses");  added for testing on testnet
const Flashloan = require("./build/contracts/FlashSwap.json");

const web3 = new Web3(
  new Web3.providers.WebsocketProvider(process.env.WSS_URL)
);
const { address: admin } = web3.eth.accounts.wallet.add(
  process.env.PRIVATE_KEY
);

const flashloanBUSD = "500";
const flashloanDAI = "1000";
const amountInBUSD = web3.utils.toBN(web3.utils.toWei(flashloanBUSD));
const amountInDAI = web3.utils.toBN(web3.utils.toWei(flashloanDAI));

const ApeSwap = new web3.eth.Contract(
  abis.apeSwap.router,
  addresses.apeSwap.router
);

const PancakeSwap = new web3.eth.Contract(
  abis.pancakeSwap.router,
  addresses.pancakeSwap.router
);

const init = async () => {
  const networkId = await web3.eth.net.getId();
  const flashloan = new web3.eth.Contract(
    Flashloan.abi,
    Flashloan.networks[networkId].address
  );

  web3.eth
    .subscribe("newBlockHeaders")
    .on("data", async (block) => {
      console.log(`New block received. Block # ${block.number}`);

      const amountsOut1 = await ApeSwap.methods
      .getAmountsIn(amountInBUSD, [
        addresses.tokens.DAI,
        addresses.tokens.BUSD,
      ])
      .call();
    const amountsOut2 = await ApeSwap.methods
      .getAmountsOut(amountInBUSD, [
        addresses.tokens.BUSD,
        addresses.tokens.DAI,
      ])
      .call();

    const amountsOut3 = await PancakeSwap.methods
      .getAmountsIn(amountInBUSD, [
        addresses.tokens.DAI,
        addresses.tokens.BUSD,
      ])
      .call();
    const amountsOut4 = await PancakeSwap.methods
      .getAmountsOut(amountInBUSD, [
        addresses.tokens.BUSD,
        addresses.tokens.DAI,
      ])
      .call();

    const amountsOut5 = await ApeSwap.methods
      .getAmountsIn(amountInDAI, [
        addresses.tokens.BUSD,
        addresses.tokens.DAI,
      ])
      .call();
    const amountsOut6 = await ApeSwap.methods
      .getAmountsOut(amountInDAI, [
        addresses.tokens.DAI,
        addresses.tokens.BUSD,
      ])
      .call();

    const amountsOut7 = await PancakeSwap.methods
      .getAmountsIn(amountInDAI, [
        addresses.tokens.BUSD,
        addresses.tokens.DAI,
      ])
      .call();
    const amountsOut8 = await PancakeSwap.methods
      .getAmountsOut(amountInDAI, [
        addresses.tokens.DAI,
        addresses.tokens.BUSD,
      ])
      .call();

    const aperesults = {
      buy: amountsOut1[0] / 10 ** 18,
      sell: amountsOut2[1] / 10 ** 18,
    };
    const aperesults2 = {
      buy: amountsOut5[0] / 10 ** 18,
      sell: amountsOut6[1] / 10 ** 18,
    };

    const pancakeresults = {
      buy: amountsOut3[0] / 10 ** 18,
      sell: amountsOut4[1] / 10 ** 18,
    };
    const pancakeresults2 = {
      buy: amountsOut7[0] / 10 ** 18,
      sell: amountsOut8[1] / 10 ** 18,
    };

    console.log(`ApeSwap ${flashloanBUSD} BUSD/DAI `);
    console.log(aperesults);

    console.log(`PancakeSwap ${flashloanBUSD} BUSD/DAI`);
    console.log(pancakeresults);

    console.log(`ApeSwap ${flashloanDAI} DAI/BUSD`);
    console.log(aperesults2);

    console.log(`PancakeSwap${flashloanDAI} DAI/BUSD `);
    console.log(pancakeresults2);

      //Payback fee calc

      const pancakeBnbPrice =
        (pancakeresults.buy + pancakeresults.sell) / flashloanDAI / 2;
      const apeswapBnbPrice =
        (aperesults.buy + aperesults.sell) / flashloanDAI / 2;

      let pancakePaybackCalcBusd = (pancakeresults.buy / 0.997) * 10 ** 18;
      let apeswapPaybackCalcBusd = (aperesults.buy / 0.997) * 10 ** 18;
      let apePaybackCalcDAI = (aperesults2.buy / 0.997) * 10 ** 18;
      let pancakePaybackCalcDAI = (pancakeresults2.buy / 0.997) * 10 ** 18;

      let repayBusdPancakeFee =
        pancakePaybackCalcBusd / 10 ** 18 - pancakeresults.buy;
      let repayBusdApeswapFee =
        apeswapPaybackCalcBusd / 10 ** 18 - aperesults.buy;
      let repayDAIPancakeFee =
        (pancakePaybackCalcDAI / 10 ** 18 - pancakeresults2.buy) *
        pancakeBnbPrice;
      let repayDAIApeswapFee =
        (apePaybackCalcDAI / 10 ** 18 - aperesults2.buy) * apeswapBnbPrice;

      const gasPrice = await web3.eth.getGasPrice();
      const txCost =
        ((350000 * parseInt(gasPrice)) / 10 ** 18) * pancakeBnbPrice;

      //Profit Calc
      const profit1 =
        aperesults.sell - pancakeresults.buy - txCost - repayBusdApeswapFee;
      const profit2 =
        pancakeresults.sell - aperesults.buy - txCost - repayBusdPancakeFee;
      const profit3 =
        pancakeresults2.sell - aperesults2.buy - txCost - repayDAIPancakeFee;
      const profit4 =
        aperesults2.sell - pancakeresults2.buy - txCost - repayDAIApeswapFee;

      if (profit1 > 0 && profit1 > profit2) {
        console.log("Arb opportunity found!");
        console.log(`Flashloan DAI on Apeswap at ${aperesults.buy} `);
        console.log(`Sell DAI on PancakeSwap at ${pancakeresults.sell} `);
        console.log(`Expected cost of flashswap: ${repayBusdPancakeFee}`);
        console.log(`Expected Gas cost: ${txCost}`);
        console.log(`Expected profit: ${profit1} BUSD`);

        let tx = flashloan.methods.startArbitrage(
          addresses.tokens.DAI, //token1
          addresses.tokens.BUSD, //token2
          amountInDAI.toString(), //amount0
          0, //amount1
          addresses.apeSwap.factory, //apefactory
          addresses.pancakeSwap.router, //pancakerouter
          apePaybackCalcDAI.toString()
        );

        const data = tx.encodeABI();
        const txData = {
          from: admin,
          to: flashloan.options.address,
          data,
          gas: "500000",
          gasPrice: gasPrice,
        };
        const receipt = await web3.eth.sendTransaction(txData);
        console.log(`Transaction hash: ${receipt.transactionHash}`);
      }

      if (profit2 > 0 && profit2 > profit1) {
        console.log("Arb opportunity found!");
        console.log(`Buy DAI from PancakeSwap at ${pancakeresults.buy} `);
        console.log(`Sell DAI from ApeSwap at ${aperesults.sell}`);
        console.log(`Expected cost of flashswap: ${repayBusdApeswapFee}`);
        console.log(`Expected Gas cost: ${txCost}`);
        console.log(`Expected profit: ${profit2} BUSD`);

        let tx = flashloan.methods.startArbitrage(
          addresses.tokens.DAI, //token1
          addresses.tokens.BUSD, //token2
          amountInDAI.toString(), //amount0
          0, //amount1
          addresses.pancakeSwap.factory, //pancakefactory
          addresses.apeSwap.router, // aperouter
          pancakePaybackCalcDAI.toString()
        );

        const data = tx.encodeABI();
        const txData = {
          from: admin,
          to: flashloan.options.address,
          data,
          gas: "500000",
          gasPrice: gasPrice,
        };
        const receipt = await web3.eth.sendTransaction(txData);
        console.log(`Transaction hash: ${receipt.transactionHash}`);
      }

      if (profit3 > 0 && profit3 > profit4) {
        console.log("Arb opportunity found!");
        console.log(`Flashloan BUSD on Apeswap at ${aperesults2.buy} `);
        console.log(`Sell BUSD on PancakeSwap at ${pancakeresults2.sell} `);
        console.log(`Expected cost of flashswap: ${repayDAIApeswapFee}`);
        console.log(`Expected Gas cost: ${txCost}`);
        console.log(`Expected profit: ${profit3} DAI`);

        let tx = flashloan.methods.startArbitrage(
          addresses.tokens.BUSD, //token1
          addresses.tokens.DAI, //token2
          0, //amount0
          amountInBUSD.toString(), //amount1
          addresses.apeSwap.factory, //apefactory
          addresses.pancakeSwap.router, //pancakerouter
          apeswapPaybackCalcBusd.toString()
        );

        const data = tx.encodeABI();
        const txData = {
          from: admin,
          to: flashloan.options.address,
          data,
          gas: "500000",
          gasPrice: gasPrice,
        };
        const receipt = await web3.eth.sendTransaction(txData);
        console.log(`Transaction hash: ${receipt.transactionHash}`);
      }

      if (profit4 > 0 && profit4 > profit3) {
        console.log("Arb opportunity found!");
        console.log(`Flashloan BUSD on PancakeSwap at ${pancakeresults2.buy} `);
        console.log(`Sell BUSD on  at Apeswap ${aperesults2.sell} `);
        console.log(`Expected cost of flashswap: ${repayDAIPancakeFee}`);
        console.log(`Expected Gas cost: ${txCost}`);
        console.log(`Expected profit: ${profit4} DAI`);

        let tx = flashloan.methods.startArbitrage(
          //token1
          addresses.tokens.DAI,
          addresses.tokens.BUSD, //token2
          0, //amount0
          amountInBUSD.toString(), //amount1
          addresses.pancakeSwap.factory, //pancakeFactory
          addresses.apeSwap.router, //apeRouter
          pancakePaybackCalcBusd.toString()
        );

        const data = tx.encodeABI();
        const txData = {
          from: admin,
          to: flashloan.options.address,
          data,
          gas: "500000",
          gasPrice: gasPrice,
        };
        const receipt = await web3.eth.sendTransaction(txData);
        console.log(`Transaction hash: ${receipt.transactionHash}`);
      }
    })
    .on("error", (error) => {
      console.log(error);
    });
};
init();
