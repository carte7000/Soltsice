// typings originally from https://github.com/ethereum/web3.js/pull/897
// and https://github.com/0xProject/web3-typescript-typings

import { BigNumber } from 'bignumber.js'; // TODO change to BN
import * as us from 'underscore';

let Web3JS = require('web3');

// this is the only class wrapper over JS object, others are interfaces
// cannot just cast from JS, but ctor does some standard logic to resolve web3
// so we do not need cast but could just use new Web3()

/** Convert number or hex string to BigNumber */
export function toBN(value: number): BigNumber {
    return new BigNumber(value);
}

// tslint:disable:member-ordering
// tslint:disable:max-line-length

/**
 * Strongly-types wrapper over web3.js with additional helper methods.
 */
export class W3 {
    private static _counter: number = 0;
    private static _default: W3;
    /**
     * Default W3 instance that is used as a fallback when such an instance is not provided to a construct constructor.
     * You must set it explicitly via W3.Default setter. Use an empty `new W3()` constructor to get an instance that
     * automatically resolves to a global web3 instance `window['web3']` provided by e.g. MIST/Metamask or connects
     * to the default 8545 port if
     * no global instance is present.
     */
    static get Default(): W3 {
        if (W3._default) {
            return W3._default;
        }
        throw 'Default W3 instance is not set. Use W3.Default setter.';
        // W3._default = new W3();
        // return W3._default;
    }

    static set Default(w3: W3) {
        W3._default = w3;
    }

    static NextCounter(): number {
        // node is single-threaded
        // same provider in two W3 instances is OK, counter will be unique accross them
        W3._counter = W3._counter + 1;
        return W3._counter;
    }

    static providers: W3.Providers = Web3JS.providers;
    static givenProvider: W3.Provider = Web3JS.givenProvider;
    static modules: {
        Eth: new (provider: W3.Provider) => W3.Eth
        Net: new (provider: W3.Provider) => W3.Net
        Personal: new (provider: W3.Provider) => W3.Personal
        Shh: new (provider: W3.Provider) => W3.Shh
        Bzz: new (provider: W3.Provider) => W3.Bzz
    } = Web3JS.modules;

    get currentProvider(): W3.Provider { return this.web3 ? this.web3.currentProvider : undefined; }
    get eth(): W3.Eth { return this.web3.eth; }
    get version(): W3.Version0 { return this.web3.version; }
    get utils(): W3.Utils {
        return this.web3.utils;
    }

    /** Convert number or hex string to BigNumber */
    public toBigNumber(value: number | string): BigNumber {
        return this.web3.toBigNumber(value);
    }

    public fromDecimal(value: number | string): string {
        return this.web3.fromDecimal(value);
    }

    /**
     * web3.js untyped instance created with a resolved or given in ctor provider, if any.
     */
    public web3;

    private globalWeb3;
    private netId: Promise<string>;
    private netNode: Promise<string>;
    /**
     * Create a default Web3 instance - resolves to a global window['web3'] injected my MIST, MetaMask, etc
     * or to `localhost:8545` if not running on https.
     */
    constructor()
    /**
     * Create a W3 instance with a given provider.
     * @param provider web3.js provider.
     */
    constructor(provider: W3.Provider)
    constructor(provider?: W3.Provider) {
        let tmpWeb3;
        // console.log('Ctor provider:');
        // console.log(provider);
        if (typeof provider === 'undefined') {
            // tslint:disable-next-line:no-string-literal
            if ((typeof window !== 'undefined' && typeof window['web3'] !== 'undefined' && typeof window['web3'].currentProvider !== 'undefined')
                || this.globalWeb3) {
                // tslint:disable-next-line:no-string-literal
                this.globalWeb3 = window['web3'];
                // tslint:disable-next-line:no-string-literal
                tmpWeb3 = new Web3JS(this.globalWeb3.currentProvider);
                console.log('Using a global web3 provider.');
            } else {
                // set the provider you want from Web3.providers
                if (typeof window === 'undefined' || window.location.protocol !== 'https:') {
                    tmpWeb3 = new Web3JS(new Web3JS.providers.HttpProvider('http://localhost:8545'));
                    console.log('Cannot find global web3 provider. Using HttpProvider(http://localhost:8545).');
                } else {
                    // tslint:disable-next-line:max-line-length
                    console.log('Cannot find global web3 provider. Running on https, will not try to access localhost at 8545');
                }
            }
        } else {
            // regardless if a web3 exists, we create a new one for a specific provider
            tmpWeb3 = new Web3JS(provider);
            console.log('Using a provider from constructor.');
        }
        if (!tmpWeb3.version.api.startsWith('0.20')) {
            throw 'Only web3 0.20.xx package is currently supported';
        }
        this.web3 = tmpWeb3;

        this.updateNetworkInfo();

    }

    /** Request netid string from ctor or after provider change */
    private updateNetworkInfo(): void {
        this.netId = new Promise((resolve, reject) =>
            this.web3.version.getNetwork((error, result) => error ? reject(error) : resolve(result))
        );
        this.netNode = new Promise((resolve, reject) =>
            this.web3.version.getNode((error, result) => error ? reject(error) : resolve(result))
        );
    }

    /*
    Below are frequently used functions that should not depend on web3 API (0.20 or 1.0).
    Will update them for web3 1.0 when truffle-contract support it without sendAsync error.
    */

    public get accounts(): Promise<string[]> {
        return new Promise((resolve, reject) =>
            this.web3.eth.getAccounts((error, result) => error ? reject(error) : resolve(result)));
    }

    public get web3API(): string {
        return this.web3.version.api;
    }

    public get isPre1API(): boolean {
        return this.web3API.startsWith('0.20.');
    }

    public get isTestRPC(): Promise<boolean> {
        return this.netNode.then(node => { return node.includes('TestRPC'); });
    }

    /** Get network ID as a promise. */
    public get networkId(): Promise<string> {
        return this.netId;
    }

    public setProvider(provider: W3.Provider) {
        this.web3.setProvider(provider);
        this.updateNetworkInfo();
    }

    public sendRPC(payload: W3.JsonRPCRequest): Promise<W3.JsonRPCResponse> {
        return new Promise((resolve, reject) => {
            if (this.isPre1API) {
                this.web3.currentProvider.sendAsync(payload, (e, r) => {
                    if (e) {
                        reject(e);
                    } else {
                        resolve(r);
                    }
                });
            } else {
                this.web3.currentProvider.send(payload, (e, r) => {
                    if (e) {
                        reject(e);
                    } else {
                        resolve(r);
                    }
                });
            }
        });
    }

    /** Returns the time of the last mined block in seconds. */
    public get latestTime(): Promise<number> {
        return new Promise((resolve, reject) => {
            if (this.isPre1API) {
                this.web3.eth.getBlock('latest', (err, res) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(res.timestamp as number);
                    }
                });
            } else {
                reject('web3 1.0 support is not implemented');
            }
        });
    }

    public get blockNumber(): Promise<number> {
        // getBlockNumber(callback: (err: Error, blockNumber: number) => void): void;
        return new Promise((resolve, reject) => {
            if (this.isPre1API) {
                this.web3.eth.getBlockNumber((err, res) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(res as number);
                    }
                });
            } else {
                reject('web3 1.0 support is not implemented');
            }
        });
    }

    /** Async unlock while web3.js only has sync version */
    public async unlockAccount(account: string, password: string, duration?: number): Promise<boolean> {
        const id = 'W3:' + W3.NextCounter();
        return this.sendRPC({
            jsonrpc: '2.0',
            method: 'personal_unlockAccount',
            params: [account, password, duration || 10],
            id: id,
        }).then(async r => {
            if (r.error) {
                return false;
            }
            return <boolean>r.result;
        });
    }

}

export class TestRPC {

    private w3: W3;
    /**
     *
     */
    constructor(w3?: W3) {
        this.w3 = w3 || new W3();
    }

    /**
     * Snapshot the state of the blockchain at the current block. Takes no parameters.
     * Returns the integer id of the snapshot created.
     */
    public async snapshot(): Promise<string> {
        if (!(await this.w3.isTestRPC)) {
            throw 'Not on TestRPC';
        }
        const id = 'W3:' + W3.NextCounter();
        return this.w3.sendRPC({
            jsonrpc: '2.0',
            method: 'evm_snapshot',
            params: [],
            id: id,
        }).then(r => {
            console.log('RPC RESPONSE: ', r);
            return <string>r.result;
        });
    }

    /**
     * Revert the state of the blockchain to a previous snapshot.
     * Takes a single parameter, which is the snapshot id to revert to.
     * If no snapshot id is passed it will revert to the latest snapshot. Returns true.
     */
    public async revert(snapshotId?: string): Promise<boolean> {
        if (!(await this.w3.isTestRPC)) {
            throw 'Not on TestRPC';
        }
        const id = 'W3:' + W3.NextCounter();
        return this.w3.sendRPC({
            jsonrpc: '2.0',
            method: 'evm_revert',
            params: snapshotId ? [snapshotId] : [],
            id: id,
        }).then(async r => {
            return true;
        });
    }

    /**
     * Jump forward in time. Takes one parameter, which is the amount of time to increase in seconds.
     * Returns the total time adjustment, in seconds.
     */
    public async increaseTime(seconds: number): Promise<number> {
        if (!(await this.w3.isTestRPC)) {
            throw 'Not on TestRPC';
        }
        const id = 'W3:' + W3.NextCounter();
        return this.w3.sendRPC({
            jsonrpc: '2.0',
            method: 'evm_increaseTime',
            params: [W3.duration.seconds(seconds)],
            id: id,
        }).then(async r => {
            await this.mine();
            return <number>r.result;
        });
    }

    /**
     * Beware that due to the need of calling two separate testrpc methods and rpc calls overhead
     * it's hard to increase time precisely to a target point so design your test to tolerate
     * small fluctuations from time to time.
     *
     * @param target time in seconds
     */
    public async increaseTimeTo(target: number): Promise<number> {
        let now = await this.w3.latestTime;
        if (target < now) {
            throw Error(`Cannot increase current time(${now}) to a moment in the past(${target})`);
        }
        let diff = target - now;
        return this.increaseTime(diff);
    }

    /**
     * Force a block to be mined. Takes no parameters. Mines a block independent of whether or not mining is started or stopped.
     */
    public async mine(): Promise<void> {
        if (!(await this.w3.isTestRPC)) {
            throw 'Not on TestRPC';
        }
        const id = 'W3:' + W3.NextCounter();
        return this.w3.sendRPC({
            jsonrpc: '2.0',
            method: 'evm_mine',
            params: [],
            id: id,
        }).then(r => {
            return;
        });
    }

    public async advanceToBlock(blockNumber: number) {
        let lastBlock = await this.w3.blockNumber;
        if (lastBlock > blockNumber) {
            throw Error(`block number ${blockNumber} is in the past (current is ${lastBlock})`);
        }
        while (await this.w3.blockNumber < blockNumber) {
            await this.mine();
        }
    }
}

export namespace W3 {
    export type address = string;
    export type bytes = string;

    export function isValidAddress(addr: address): boolean {
        if (addr && addr.startsWith('0x') && addr.length === 42) {
            return true;
        }
        return false;
    }

    /** Truffle Contract */
    export namespace TC {
        export interface TxParams {
            from: address;
            gas: number;
            gasPrice: number;
            value: number;
        }

        export type ContractDataType = BigNumber | number | string | boolean | BigNumber[] | number[] | string[];

        export interface TransactionResult {
            /** Transaction hash. */
            tx: string;
            receipt: TransactionReceipt;
            /** This array has decoded events, while reseipt.logs has raw logs when returned from TC transaction */
            logs: Log[];
        }

        export function txParamsDefaultDeploy(from: address): TxParams {
            return {
                from: from,
                gas: 4712388,
                gasPrice: 20000000000,
                value: 0
            };
        }

        export function txParamsDefaultSend(from: address): TxParams {
            return {
                from: from,
                gas: 50000,
                gasPrice: 20000000000,
                value: 0
            };
        }
    }

    // '{"jsonrpc":"2.0","method":"eth_sendTransaction","params":[{see above}],"id":1}'
    export interface JsonRPCRequest {
        jsonrpc: string;
        method: string;
        params: any[];
        id: number | string;
    }
    export interface JsonRPCResponse {
        jsonrpc: string;
        id: number | string;
        result?: any;
        error?: string;
    }

    export interface Provider {
        sendAsync(
            payload: JsonRPCRequest,
            callback: (err: Error, result: JsonRPCResponse) => void,
        ): void;
    }

    // export interface Provider {
    //     send(payload: JsonRPCRequest, callback: (e: Error, val: JsonRPCResponse) => void);
    // }

    export interface WebsocketProvider extends Provider { }
    export interface HttpProvider extends Provider { }
    export interface IpcProvider extends Provider { }
    export interface Providers {
        WebsocketProvider: new (host: string, timeout?: number) => WebsocketProvider;
        HttpProvider: new (host: string, timeout?: number) => HttpProvider;
        IpcProvider: new (path: string, net: any) => IpcProvider;
    }

    // tslint:disable-next-line:max-line-length
    export type Unit = 'kwei' | 'femtoether' | 'babbage' | 'mwei' | 'picoether' | 'lovelace' | 'qwei' | 'nanoether' | 'shannon' | 'microether' | 'szabo' | 'nano' | 'micro' | 'milliether' | 'finney' | 'milli' | 'ether' | 'kether' | 'grand' | 'mether' | 'gether' | 'tether';

    export type BlockType = 'latest' | 'pending' | 'genesis' | number;

    export interface BatchRequest {
        add(request: Request): void;
        execute(): void;
    }
    export interface Iban { }
    export interface Utils {
        BN: BigNumber; // TODO only static-definition
        isBN(obj: any): boolean;
        isBigNumber(obj: any): boolean;
        isAddress(obj: any): boolean;
        isHex(obj: any): boolean;
        // tslint:disable-next-line:member-ordering
        _: us.UnderscoreStatic;
        asciiToHex(val: string): string;
        hexToAscii(val: string): string;
        bytesToHex(val: number[]): string;
        numberToHex(val: number | BigNumber): string;
        checkAddressChecksum(address: string): boolean;
        fromAscii(val: string): string;
        fromDecimal(val: string | number | BigNumber): string;
        fromUtf8(val: string): string;
        fromWei(val: string | number | BigNumber, unit: Unit): string | BigNumber;
        hexToBytes(val: string): number[];
        hexToNumber(val: string | number | BigNumber): number;
        hexToNumberString(val: string | number | BigNumber): string;
        hexToString(val: string): string;
        hexToUtf8(val: string): string;
        keccak256(val: string): string;
        leftPad(str: string, chars: number, sign: string): string;
        padLeft(str: string, chars: number, sign: string): string;
        rightPad(str: string, chars: number, sign: string): string;
        padRight(str: string, chars: number, sign: string): string;
        sha3(val: string, val2?: string, val3?: string, val4?: string, val5?: string): string;
        soliditySha3(val: string): string;
        randomHex(bytes: number): string;
        stringToHex(val: string): string;
        toAscii(hex: string): string;
        toBN(obj: any): BigNumber;
        toChecksumAddress(val: string): string;
        toDecimal(val: any): number;
        toHex(val: any): string;
        toUtf8(val: any): string;
        toWei(val: string | number | BigNumber, unit: Unit): string | BigNumber;
        // tslint:disable-next-line:member-ordering
        unitMap: any;
    }
    export type Callback<T> = (error: Error, result: T) => void;
    export type ABIDataTypes = 'uint256' | 'boolean' | 'string' | 'bytes' | string; // TODO complete list

    export interface ABIDefinition {
        constant?: boolean;
        payable?: boolean;
        anonymous?: boolean;
        inputs?: Array<{ name: string, type: ABIDataTypes, indexed?: boolean }>;
        name?: string;
        outputs?: Array<{ name: string, type: ABIDataTypes }>;
        type: 'function' | 'constructor' | 'event' | 'fallback';
    }

    export interface CompileResult {
        code: string;
        info: {
            source: string;
            language: string;
            languageVersion: string;
            compilerVersion: string;
            abiDefinition: Array<ABIDefinition>;
        };
        userDoc: { methods: object };
        developerDoc: { methods: object };
    }

    export interface Transaction {
        hash: string;
        nonce: number;
        blockHash: string;
        blockNumber: number;
        transactionIndex: number;
        from: string;
        to: string;
        value: string;
        gasPrice: string;
        gas: number;
        input: string;
        v?: string;
        r?: string;
        s?: string;
    }
    export interface EventLog {
        event: string;
        address: string;
        returnValues: object;
        logIndex: number;
        transactionIndex: number;
        transactionHash: string;
        blockHash: string;
        blockNumber: number;
        raw?: { data: string, topics: any[] };
    }

    export interface TransactionReceipt {
        transactionHash: string;
        transactionIndex: number;
        blockHash: string;
        blockNumber: number;
        from: string;
        to: string;
        contractAddress: string;
        cumulativeGasUsed: number;
        gasUsed: number;
        logs?: Log[];
        events?: {
            [eventName: string]: EventLog
        };
    }
    export interface BlockHeader {
        number: number;
        hash: string;
        parentHash: string;
        nonce: string;
        sha3Uncles: string;
        logsBloom: string;
        transactionRoot: string;
        stateRoot: string;
        receiptRoot: string;
        miner: string;
        extraData: string;
        gasLimit: number;
        gasUsed: number;
        timestamp: number;
    }
    export interface Block extends BlockHeader {
        transactions: Array<Transaction>;
        size: number;
        difficulty: number;
        totalDifficulty: number;
        uncles: Array<string>;
    }

    export interface Logs {
        fromBlock?: number;
        address?: string;
        topics?: Array<string | string[]>;

    }

    /**  */
    export interface Log {
        /** true when the log was removed, due to a chain reorganization. false if its a valid log. */
        removed?: boolean;
        logIndex: number;
        transactionIndex: number;
        transactionHash: string;
        blockHash: string;
        blockNumber: number;
        address: string;
        data?: string;
        topics?: Array<string>;

        /** Truffle-contract returns this as 'mined' */
        type?: string;

        /** Event name decoded by Truffle-contract */
        event?: string;
        /** Args passed to a Truffle-contract method */
        args?: any;
    }

    export interface Subscribe<T> {
        subscription: {
            id: string;
            subscribe(callback?: Callback<Subscribe<T>>): Subscribe<T>;
            unsubscribe(callback?: Callback<boolean>): void | boolean;
            // tslint:disable-next-line:member-ordering
            arguments: object;
        };
        /*  on(type: "data" , handler:(data:Transaction)=>void): void
          on(type: "changed" , handler:(data:Logs)=>void): void
          on(type: "error" , handler:(data:Error)=>void): void
          on(type: "block" , handler:(data:BlockHeader)=>void): void
          */
        on(type: 'data', handler: (data: T) => void): void;
        on(type: 'changed', handler: (data: T) => void): void;
        on(type: 'error', handler: (data: Error) => void): void;
    }

    export interface Account {
        address: string;
        privateKey: string;
        publicKey: string;

    }

    export interface PrivateKey {
        address: string;
        Crypto: {
            cipher: string,
            ciphertext: string,
            cipherparams: {
                iv: string
            },
            kdf: string,
            kdfparams: {
                dklen: number,
                n: number,
                p: number,
                r: number,
                salt: string
            },
            mac: string
        };
        id: string;
        version: number;
    }

    export interface Signature {
        message: string;
        hash: string;
        r: string;
        s: string;
        v: string;
    }
    export interface Tx {
        nonce?: string | number;
        chainId?: string | number;
        from?: string;
        to?: string;
        data?: string;
        value?: string | number;
        gas?: string | number;
        gasPrice?: string | number;
    }

    export interface ContractOptions {
        address: string;
        jsonInterface: ABIDefinition[];
        from?: string;
        gas?: string | number | BigNumber;
        gasPrice?: number;
        data?: string;
    }

    export type PromiEventType = 'transactionHash' | 'receipt' | 'confirmation' | 'error';
    export interface PromiEvent<T> extends Promise<T> {
        once(type: 'transactionHash', handler: (receipt: string) => void): PromiEvent<T>;
        once(type: 'receipt', handler: (receipt: TransactionReceipt) => void): PromiEvent<T>;
        once(type: 'confirmation', handler: (confNumber: number, receipt: TransactionReceipt) => void): PromiEvent<T>;
        once(type: 'error', handler: (error: Error) => void): PromiEvent<T>;
        // tslint:disable-next-line:max-line-length
        once(type: 'error' | 'confirmation' | 'receipt' | 'transactionHash', handler: (error: Error | TransactionReceipt | string) => void): PromiEvent<T>;
        on(type: 'transactionHash', handler: (receipt: string) => void): PromiEvent<T>;
        on(type: 'receipt', handler: (receipt: TransactionReceipt) => void): PromiEvent<T>;
        on(type: 'confirmation', handler: (confNumber: number, receipt: TransactionReceipt) => void): PromiEvent<T>;
        on(type: 'error', handler: (error: Error) => void): PromiEvent<T>;
        // tslint:disable-next-line:max-line-length
        on(type: 'error' | 'confirmation' | 'receipt' | 'transactionHash', handler: (error: Error | TransactionReceipt | string) => void): PromiEvent<T>;
    }
    export interface EventEmitter {
        on(type: 'data', handler: (event: EventLog) => void): EventEmitter;
        on(type: 'changed', handler: (receipt: EventLog) => void): EventEmitter;
        on(type: 'error', handler: (error: Error) => void): EventEmitter;
        // tslint:disable-next-line:max-line-length
        on(type: 'error' | 'data' | 'changed', handler: (error: Error | TransactionReceipt | string) => void): EventEmitter;
    }

    export interface TransactionObject<T> {
        arguments: any[];
        call(tx?: Tx): Promise<T>;
        send(tx?: Tx): PromiEvent<T>;
        estimateGas(tx?: Tx): Promise<number>;
        encodeABI(): string;
    }

    export interface Contract {
        options: ContractOptions;
        methods: {
            [fnName: string]: (...args: any[]) => TransactionObject<any>
        };
        deploy(options: {
            data: string
            arguments: any[]
        }): TransactionObject<Contract>;
        // tslint:disable-next-line:member-ordering
        events: {
            [eventName: string]: (options?: {
                filter?: object
                fromBlock?: BlockType
                topics?: any[]
            }, cb?: Callback<EventLog>) => EventEmitter
            // tslint:disable-next-line:max-line-length
            allEvents: (options?: { filter?: object, fromBlock?: BlockType, topics?: any[] }, cb?: Callback<EventLog>) => EventEmitter
        };

    }

    export interface Eth {
        readonly defaultAccount: string;
        readonly defaultBlock: BlockType;
        BatchRequest: new () => BatchRequest;
        Iban: new (address: string) => Iban;
        Contract: new (jsonInterface: any[], address?: string, options?: {
            from?: string
            gas?: string | number | BigNumber
            gasPrice?: number
            data?: string
        }) => Contract;
        abi: {
            decodeLog(inputs: object, hexString: string, topics: string[]): object
            encodeParameter(type: string, parameter: any): string
            encodeParameters(types: string[], paramaters: any[]): string
            encodeEventSignature(name: string | object): string
            encodeFunctionCall(jsonInterface: object, parameters: any[]): string
            encodeFunctionSignature(name: string | object): string
            decodeParameter(type: string, hex: string): any
            decodeParameters(types: string[], hex: string): any
        };
        accounts: {
            'new'(entropy?: string): Account
            privateToAccount(privKey: string): Account
            publicToAddress(key: string): string
            // tslint:disable-next-line:max-line-length
            signTransaction(tx: Tx, privateKey: string, returnSignature?: boolean, cb?: (err: Error, result: string | Signature) => void): Promise<string> | Signature;
            recoverTransaction(signature: string | Signature): string
            sign(data: string, privateKey: string, returnSignature?: boolean): string | Signature
            recover(signature: string | Signature): string
            encrypt(privateKey: string, password: string): PrivateKey
            decrypt(privateKey: PrivateKey, password: string): Account
            // tslint:disable-next-line:member-ordering
            wallet: {
                'new'(numberOfAccounts: number, entropy: string): Account[]
                add(account: string | Account): any
                remove(account: string | number): any
                save(password: string, keyname?: string): string
                load(password: string, keyname: string): any
                clear(): any
            }
        };
        call(callObject: Tx, defaultBloc?: BlockType, callBack?: Callback<string>): Promise<string>;
        clearSubscriptions(): boolean;
        subscribe(type: 'logs', options?: Logs, callback?: Callback<Subscribe<Log>>): Promise<Subscribe<Log>>;
        subscribe(type: 'syncing', callback?: Callback<Subscribe<any>>): Promise<Subscribe<any>>;
        // tslint:disable-next-line:max-line-length
        subscribe(type: 'newBlockHeaders', callback?: Callback<Subscribe<BlockHeader>>): Promise<Subscribe<BlockHeader>>;
        subscribe(type: 'pendingTransactions', callback?: Callback<Subscribe<Transaction>>): Promise<Subscribe<Transaction>>;
        // tslint:disable-next-line:max-line-length
        subscribe(type: 'pendingTransactions' | 'newBlockHeaders' | 'syncing' | 'logs', options?: Logs, callback?: Callback<Subscribe<Transaction | BlockHeader | any>>): Promise<Subscribe<Transaction | BlockHeader | any>>;

        unsubscribe(callBack: Callback<boolean>): void | boolean;
        // tslint:disable-next-line:member-ordering
        compile: {
            solidity(source: string, callback?: Callback<CompileResult>): Promise<CompileResult>;
            lll(source: string, callback?: Callback<CompileResult>): Promise<CompileResult>;
            serpent(source: string, callback?: Callback<CompileResult>): Promise<CompileResult>;
        };
        // tslint:disable-next-line:member-ordering
        currentProvider: Provider;
        estimateGas(tx: Tx, callback?: Callback<number>): Promise<number>;
        getAccounts(cb?: Callback<Array<string>>): Promise<Array<string>>;
        getBalance(address: string, defaultBlock?: BlockType, cb?: Callback<number>): Promise<number>;
        // tslint:disable-next-line:variable-name
        getBlock(number: BlockType, returnTransactionObjects?: boolean, cb?: Callback<Block>): Promise<Block>;
        getBlockNumber(callback?: Callback<number>): Promise<number>;
        // tslint:disable-next-line:variable-name
        getBlockTransactionCount(number: BlockType | string, cb?: Callback<number>): Promise<number>;
        // tslint:disable-next-line:variable-name
        getBlockUncleCount(number: BlockType | string, cb?: Callback<number>): Promise<number>;
        getCode(address: string, defaultBlock?: BlockType, cb?: Callback<string>): Promise<string>;
        getCoinbase(cb?: Callback<string>): Promise<string>;
        getCompilers(cb?: Callback<string[]>): Promise<string[]>;
        getGasPrice(cb?: Callback<number>): Promise<number>;
        getHashrate(cb?: Callback<number>): Promise<number>;
        getPastLogs(options: {
            fromBlock?: BlockType
            toBlock?: BlockType
            address: string
            topics?: Array<string | Array<string>>
        }, cb?: Callback<Array<Log>>): Promise<Array<Log>>;
        getProtocolVersion(cb?: Callback<string>): Promise<string>;
        getStorageAt(address: string, defaultBlock?: BlockType, cb?: Callback<string>): Promise<string>;
        getTransactionReceipt(hash: string, cb?: Callback<TransactionReceipt>): Promise<TransactionReceipt>;
        getTransaction(hash: string, cb?: Callback<Transaction>): Promise<Transaction>;
        getTransactionCount(address: string, defaultBlock?: BlockType, cb?: Callback<number>): Promise<number>;
        getTransactionFromBlock(block: BlockType, index: number, cb?: Callback<Transaction>): Promise<Transaction>;
        // tslint:disable-next-line:max-line-length
        getUncle(blockHashOrBlockNumber: BlockType | string, uncleIndex: number, returnTransactionObjects?: boolean, cb?: Callback<Block>): Promise<Block>;
        getWork(cb?: Callback<Array<string>>): Promise<Array<string>>;
        // tslint:disable-next-line:member-ordering
        givenProvider: Provider;
        isMining(cb?: Callback<boolean>): Promise<boolean>;
        isSyncing(cb?: Callback<boolean>): Promise<boolean>;
        // tslint:disable-next-line:member-ordering
        net: Net;
        // tslint:disable-next-line:member-ordering
        personal: Personal;
        sendSignedTransaction(data: string, cb?: Callback<string>): PromiEvent<TransactionReceipt>;
        sendTransaction(tx: Tx, cb?: Callback<string>): PromiEvent<TransactionReceipt>;
        submitWork(nonce: string, powHash: string, digest: string, cb?: Callback<boolean>): Promise<boolean>;
        sign(address: string, dataToSign: string, cb?: Callback<string>): Promise<string>;
    }

    export interface SyncingState {
        startingBlock: number;
        currentBlock: number;
        highestBlock: number;
    }

    export type SyncingResult = false | SyncingState;

    export interface Version0 {
        api: string;
        network: string;
        node: string;
        ethereum: string;
        whisper: string;
        getNetwork(callback: (err: Error, networkId: string) => void): void;
        getNode(callback: (err: Error, nodeVersion: string) => void): void;
        getEthereum(callback: (err: Error, ethereum: string) => void): void;
        getWhisper(callback: (err: Error, whisper: string) => void): void;
    }
    export interface Net { }

    export interface Personal {
        newAccount(password: string, cb?: Callback<boolean>): Promise<boolean>;
        getAccounts(cb?: Callback<Array<string>>): Promise<Array<string>>;
        importRawKey();
        lockAccount();
        unlockAccount();
        sign();
    }

    export interface Shh { }

    export interface Bzz { }

    export const duration = {
        seconds: function (val: number) { return val; },
        minutes: function (val: number) { return val * this.seconds(60); },
        hours: function (val: number) { return val * this.minutes(60); },
        days: function (val: number) { return val * this.hours(24); },
        weeks: function (val: number) { return val * this.days(7); },
        years: function (val: number) { return val * this.days(365); }
    };
}
