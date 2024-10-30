import { Accordion, AccordionItem } from "@nextui-org/accordion";
import { Button } from "@nextui-org/button";

import { Address, Data, fromText, LucidEvolution, MintingPolicy, SpendingValidator, TxSignBuilder, Validator } from "@lucid-evolution/lucid";
import {
  applyDoubleCborEncoding,
  applyParamsToScript,
  mintingPolicyToId,
  paymentCredentialOf,
  scriptHashToCredential,
  validatorToAddress,
  validatorToScriptHash,
} from "@lucid-evolution/utils";

const Script = {
  MintSpend: applyDoubleCborEncoding(
    "58ea010100323232323232322533300232323232323253233300930010021323370e6eb40152054375c601a60166ea800c54ccc024cdc3a4004004264646464a66601a600a601c6ea80084c8c94cccccc0540080040040044cdc39bad002481500044c94cccccc0540080040040040044cdc79bae00248810d48656c6c6f2c20576f726c64210014a06022601e6ea8008528a999806180218069baa0071533300f300e375400e2930b0b18079808001180700098059baa00316370e900018041baa001300a300b0023009001300900230070013004375400229309b2b2b9a5573aaae7955cfaba15744ae901"
  ),

  WithdrawPublish: applyDoubleCborEncoding(
    "5901110101003232323232322322533300432323232323232533300b3370e900200109919198019bac301130123012301230123012301230123012300f3754010016a66601866e1d2000300d375400a2a66601e601c6ea80145261616300f300d37540062a66601666e1d200600213232323233005375860266028602860286028602860286028602860226ea80280354ccc038cdc3a4000601e6ea801c54ccc044c040dd50038a4c2c2c602260240046eb4c040004c034dd50018b1119198008008019129998088008a50132533300f3371e6eb8c04c008010528899801801800980980098051baa001300c300d002300b001300b00230090013006375400229309b2b1bae0015734aae7555cf2ab9f5742ae89"
  ),
};

export default function Dashboard(props: {
  lucid: LucidEvolution;
  address: Address;
  setActionResult: (result: string) => void;
  onError: (error: any) => void;
}) {
  const { lucid, address, setActionResult, onError } = props;

  async function submitTx(tx: TxSignBuilder) {
    const txSigned = await tx.sign.withWallet().complete();
    const txHash = await txSigned.submit();

    return txHash;
  }

  type Action = () => Promise<void>;
  type ActionGroup = Record<string, Action>;

  const actions: Record<string, ActionGroup> = {
    Minting: {
      mint: async () => {
        try {
          const mintingValidator: MintingPolicy = { type: "PlutusV3", script: Script.MintSpend };

          const policyID = mintingPolicyToId(mintingValidator);
          const assetName = "42 Token";

          const mintedAssets = { [`${policyID}${fromText(assetName)}`]: 42n };
          const redeemer = Data.to(42n);

          const tx = await lucid
            .newTx()
            .mintAssets(mintedAssets, redeemer)
            .attach.MintingPolicy(mintingValidator)
            .attachMetadata(
              721,
              // https://github.com/cardano-foundation/CIPs/tree/master/CIP-0025#version-1
              {
                [policyID]: {
                  [assetName]: {
                    name: assetName,
                    image: "https://avatars.githubusercontent.com/u/1",
                  },
                },
              }
            )
            .complete();

          submitTx(tx).then(setActionResult).catch(onError);
        } catch (error) {
          onError(error);
        }
      },

      burn: async () => {
        try {
          const mintingValidator: MintingPolicy = { type: "PlutusV3", script: Script.MintSpend };

          const policyID = mintingPolicyToId(mintingValidator);
          const assetName = "42 Token";
          const assetUnit = `${policyID}${fromText(assetName)}`;
          const burnedAssets = { [assetUnit]: -42n };
          const redeemer = Data.to(42n);

          const utxos = await lucid.utxosAtWithUnit(address, assetUnit);

          const tx = await lucid.newTx().collectFrom(utxos).mintAssets(burnedAssets, redeemer).attach.MintingPolicy(mintingValidator).complete();

          submitTx(tx).then(setActionResult).catch(onError);
        } catch (error) {
          onError(error);
        }
      },
    },

    Spending: {
      deposit: async () => {
        try {
          const { network } = lucid.config();
          const pkh = paymentCredentialOf(address).hash;

          //#region Contract Address
          const spendingValidator: SpendingValidator = { type: "PlutusV3", script: Script.MintSpend };
          const stakingValidator: Validator = { type: "PlutusV3", script: applyParamsToScript(Script.WithdrawPublish, [pkh]) };

          const stakeScriptHash = validatorToScriptHash(stakingValidator);
          const stakeCredential = scriptHashToCredential(stakeScriptHash);

          const contractAddress = validatorToAddress(network, spendingValidator, stakeCredential);
          //#endregion

          const tx = await lucid.newTx().pay.ToAddress(contractAddress, { lovelace: 42_000000n }).complete();

          submitTx(tx).then(setActionResult).catch(onError);
        } catch (error) {
          onError(error);
        }
      },

      withdraw: async () => {
        try {
          const { network } = lucid.config();
          const pkh = paymentCredentialOf(address).hash;

          //#region Contract Address
          const spendingValidator: SpendingValidator = { type: "PlutusV3", script: Script.MintSpend };
          const stakingValidator: Validator = { type: "PlutusV3", script: applyParamsToScript(Script.WithdrawPublish, [pkh]) };

          const stakeScriptHash = validatorToScriptHash(stakingValidator);
          const stakeCredential = scriptHashToCredential(stakeScriptHash);

          const contractAddress = validatorToAddress(network, spendingValidator, stakeCredential);
          //#endregion

          const redeemer = Data.void();

          const utxos = await lucid.utxosAt(contractAddress);

          const tx = await lucid.newTx().collectFrom(utxos, redeemer).attach.SpendingValidator(spendingValidator).addSigner(address).complete();

          submitTx(tx).then(setActionResult).catch(onError);
        } catch (error) {
          onError(error);
        }
      },
    },
  };

  return (
    <div className="flex flex-col gap-2">
      <span>{address}</span>

      <Accordion variant="splitted">
        {/* Minting */}
        <AccordionItem key="1" aria-label="Accordion 1" title="Minting">
          <div className="flex flex-wrap gap-2 mb-2">
            <Button onClick={actions.Minting.mint} className="bg-gradient-to-tr from-pink-500 to-yellow-500 text-white shadow-lg" radius="full">
              Mint
            </Button>
            <Button onClick={actions.Minting.burn} className="bg-gradient-to-tr from-pink-500 to-yellow-500 text-white shadow-lg" radius="full">
              Burn
            </Button>
          </div>
        </AccordionItem>

        {/* Spending */}
        <AccordionItem key="2" aria-label="Accordion 2" title="Spending">
          <div className="flex flex-wrap gap-2 mb-2">
            <Button onClick={actions.Spending.deposit} className="bg-gradient-to-tr from-pink-500 to-yellow-500 text-white shadow-lg" radius="full">
              Deposit
            </Button>
            <Button onClick={actions.Spending.withdraw} className="bg-gradient-to-tr from-pink-500 to-yellow-500 text-white shadow-lg" radius="full">
              Withdraw
            </Button>
          </div>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
