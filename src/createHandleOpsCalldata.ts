import util from "node:util";
import { UserOperation } from "permissionless";
import {
	Address,
	Hex,
	concat,
	encodeAbiParameters,
	encodeFunctionData,
	getAddress,
	keccak256,
	parseGwei,
} from "viem";
import { signMessage } from "viem/accounts";
import {
	getEntryPointAddress,
	getFactoryAddress,
	getSmartAccountAddress,
	kakarotChain,
} from "./constants";
import yargs from "yargs";

const packUserOpV06 = (userOperation: UserOperation<"v0.6">): Hex => {
	const hashedInitCode = keccak256(userOperation.initCode);
	const hashedCallData = keccak256(userOperation.callData);
	const hashedPaymasterAndData = keccak256(userOperation.paymasterAndData);

	return encodeAbiParameters(
		[
			{ type: "address" },
			{ type: "uint256" },
			{ type: "bytes32" },
			{ type: "bytes32" },
			{ type: "uint256" },
			{ type: "uint256" },
			{ type: "uint256" },
			{ type: "uint256" },
			{ type: "uint256" },
			{ type: "bytes32" },
		],
		[
			userOperation.sender as Address,
			userOperation.nonce,
			hashedInitCode,
			hashedCallData,
			userOperation.callGasLimit,
			userOperation.verificationGasLimit,
			userOperation.preVerificationGas,
			userOperation.maxFeePerGas,
			userOperation.maxPriorityFeePerGas,
			hashedPaymasterAndData,
		],
	);
};

const getUserOperationHashV06 = (
	userOperation: UserOperation<"v0.6">,
	entryPoint: Address,
) => {
	const encoded = encodeAbiParameters(
		[{ type: "bytes32" }, { type: "address" }, { type: "uint256" }],
		[
			keccak256(packUserOpV06(userOperation)),
			entryPoint,
			BigInt(kakarotChain.id),
		],
	) as `0x${string}`;

	return keccak256(encoded);
};

const ownerPrivateKey =
	"0x054ba307210c75ee6438cf0b4afa7d9f243f1de4a562e078597b178ded1c8d32";

const abi = [
	{
		inputs: [
			{
				components: [
					{
						internalType: "address",
						name: "sender",
						type: "address",
					},
					{
						internalType: "uint256",
						name: "nonce",
						type: "uint256",
					},
					{
						internalType: "bytes",
						name: "initCode",
						type: "bytes",
					},
					{
						internalType: "bytes",
						name: "callData",
						type: "bytes",
					},
					{
						internalType: "uint256",
						name: "callGasLimit",
						type: "uint256",
					},
					{
						internalType: "uint256",
						name: "verificationGasLimit",
						type: "uint256",
					},
					{
						internalType: "uint256",
						name: "preVerificationGas",
						type: "uint256",
					},
					{
						internalType: "uint256",
						name: "maxFeePerGas",
						type: "uint256",
					},
					{
						internalType: "uint256",
						name: "maxPriorityFeePerGas",
						type: "uint256",
					},
					{
						internalType: "bytes",
						name: "paymasterAndData",
						type: "bytes",
					},
					{
						internalType: "bytes",
						name: "signature",
						type: "bytes",
					},
				],
				internalType: "struct UserOperation[]",
				name: "ops",
				type: "tuple[]",
			},
			{
				internalType: "address payable",
				name: "beneficiary",
				type: "address",
			},
		],
		name: "handleOps",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
] as const;

const main = async () => {
	const argv = await yargs
		.option("entry-point", {
			alias: "e",
			type: "string",
			description: "EntryPoint Address",
		})
		.option("smart-account", {
			alias: "s",
			type: "string",
			description: "SmartAccount Address",
		})
		.option("factory", {
			alias: "f",
			type: "string",
			description: "Factory Address",
		})
		.help()
		.alias("help", "h").argv;

	if (!argv["entry-point"]) {
		console.log("missing flag `--entry-point`");
		process.exit(0);
	}
	const entryPoint = getAddress(argv["entry-point"]);

	if (!argv["smart-account"]) {
		console.log("missing flag `--smart-account`");
		process.exit(0);
	}
	const smartAccount = getAddress(argv["smart-account"]);

	if (!argv["factory"]) {
		console.log("missing flag `--factory`");
		process.exit(0);
	}
	const factory = getAddress(argv["factory"]);

	let userOperation: UserOperation<"v0.6"> = {
		sender: smartAccount,
		nonce: 0n,
		initCode: concat([
			factory,
			"0x5fbfb9cf0000000000000000000000000503F3dC17c544a92Ed0AE9666000c9B6Ee591120000000000000000000000000000000000000000000000000000000000000000",
		]),
		callData: "0x",
		callGasLimit: 350_000n,
		verificationGasLimit: 550_000n,
		preVerificationGas: 250_000n,
		maxFeePerGas: parseGwei("1"),
		maxPriorityFeePerGas: parseGwei("0.15"),
		paymasterAndData: "0x",
		signature: "0x",
	};

	userOperation.signature = await signMessage({
		privateKey: ownerPrivateKey,
		message: {
			raw: getUserOperationHashV06(userOperation, entryPoint),
		},
	});

	console.log(`UserOperation:\n${util.inspect(userOperation)}\n`);

	const calldata = encodeFunctionData({
		abi,
		args: [[userOperation], "0x433704c40F80cBff02e86FD36Bc8baC5e31eB0c1"],
	});

	console.log(`HandleOps Calldata:\n${calldata}`);
};

main();
