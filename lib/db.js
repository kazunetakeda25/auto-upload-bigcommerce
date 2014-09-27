var Knex   = require('knex');
var Promise = require('bluebird');

var SerializedObject = require('ripple-lib').SerializedObject;
var UInt160 = require('ripple-lib').UInt160;

//Main
var DB = function(config) {
	var self = this;
	var knex = Knex.initialize({
		client     : config.dbtype,
		connection : config.db
	});
	var bookshelf = require('bookshelf')(knex);
	
	//Define Bookshelf models
	var Ledger = bookshelf.Model.extend({
		tableName: 'ledgers',
		idAttribute: null
	});

	var Transaction = bookshelf.Model.extend({
		tableName: 'transactions',
		idAttribute: null
	});

	var Account = bookshelf.Model.extend({
		tableName: 'accounts',
		idAttribute: null
	});

	var Account_Transaction = bookshelf.Model.extend({
		tableName: 'account_transactions',
		idAttribute: null
	});

	//Parse ledger and add to database
	self.saveLedger = function (ledger, callback) {
		//console.log(ledger.transactions[0]);

		//Preprocess
		var ledger_info = parse_ledger(ledger);

		//Add all transactions to an array
		var tx_array = parse_transactions(ledger);

		//Add array atomically
		insert_all(tx_array, ledger_info);

		//Return all transactions in json
		//get_all();
	};

	//Given an array of queries, add to database atomically
	function insert_all(tx_array, ledger_info){
		bookshelf.transaction(function(t){
			console.log("Starting new DB call...");
			return ledger_info.save({},{method: 'insert', transacting: t})
				.tap(function(l){
					li = l.get('ledger_index');
					return Promise.map(tx_array, function(model){
						model.tx.save({ledger_index: li},{method: 'insert', transacting: t});
						return Promise.map(model.account, function(account){
							console.log(account.get('account'));

							new Account({account: account.get('account')})
								.fetch()
								.then(function(model){
									if (model == null){
										console.log('does not exist');
										account.save({},{method: 'insert', transacting: t}).then(function(){
											console.log('added');
										});
									}
									else{
										console.log("exists");
									}
								})
						})
					})
				})
		})
		.then(function(){
			console.log("Done.");
		});
	}

	//Pre-process all transactions
	function parse_transactions(ledger){
		var transaction_list = [];
		//Iterate through transactions, create Transaction and add it to array
		for (var i=0; i<ledger.transactions.length; i++){
			var transaction = ledger.transactions[i];
			var meta = transaction.metaData;
			delete transaction.metaData;
			var affected_nodes = meta.AffectedNodes;

			//Convert meta and tx (transaction minus meta) to hex
			var hex_tx = to_hex(transaction);
			var hex_meta = to_hex(meta);

			var tranaction_info = Transaction.forge({
				tx_hash: transaction.hash,
				tx_type: transaction.TransactionType,
				account: transaction.Account,
				tx_sequence: transaction.Sequence,
				result: meta.TransactionResult,
				tx_raw: hex_tx,
				tx_meta: hex_meta
				//time
			});

			//Iterate through affected nodes in each transaction,
			//create Account_Transaction and add it to array
/*			var addresses = [];
			affected_nodes.forEach( function( affNode ) {
				var node = affNode.CreatedNode || affNode.ModifiedNode || affNode.DeletedNode;
				if (node.hasOwnProperty('FinalFields')){
					var ff = node.FinalFields;
					addresses = check_fields(ff, addresses);
				}
				if (node.hasOwnProperty('NewFields')){
					var nf = node.NewFields;
					addresses = check_fields(nf, addresses);
				}
			});

			console.log(addresses);*/
			test = Account.forge({account: "rGJrzrNBfv6ndJmzt1hTUJVx7z8o2bg3of"})
			transaction_list.push({tx: tranaction_info, account: [test]});

		}
		return transaction_list;
	}

	//Pre-process ledger information, create Ledger, add to array
	function parse_ledger(ledger){
		var ledger_info = Ledger.forge({
			ledger_index: ledger.seqNum,
			ledger_hash: ledger.hash,
			parent_hash: ledger.parent_hash,
			total_coins: ledger.total_coins,
			close_time: ledger.close_time,
			close_time_resolution: ledger.close_time_resolution,
			close_time_human: ledger.close_time_human,
			accounts_hash: ledger.account_hash,
			transactions_hash: ledger.transaction_hash
		});
		return ledger_info;
	}

	//Convert json to binary/hex to store as raw data
	function to_hex(input){
		hex = new SerializedObject.from_json(input).to_hex();
		return hex;
	}

	function get_all(){
		new Transaction().fetchAll()
			.then(function(collection){
				console.log(collection.toJSON());
		});
	}

	function check_fields(fields, addresses){

		//FIX VALIDATION
/*		var address = UInt160.from_json();
		console.log(address.is_valid())*/

		for (var key in fields){
			//Check if valid Ripple Address
			var address = UInt160.from_json(String(fields[key]));
			if(address.is_valid() && fields[key].charAt(0) == "r"){
				addresses.push(fields[key]);
			}
		}
		/*if (fields.hasOwnProperty('HighLimit')){
			console.log(fields.HighLimit.issuer);
			//Check if valid Ripple Address
		}
		if (fields.hasOwnProperty('LowLimit')){
			console.log(fields.LowLimit.issuer);
			//Check if valid Ripple Address
		}
		if (fields.hasOwnProperty('TakerPays')){
			console.log(fields.TakerPays.issuer);
			//Check if valid Ripple Address
		}
		if (fields.hasOwnProperty('TakerGets')){
			console.log(fields.TakerGets.issuer);
			//Check if valid Ripple Address
		}*/

		return addresses;
	}

	//Checks whether a token is in an array
	checkUnique = function(entry, array){
		is_unique = true;
		for (index in array){
			if (array[index] == entry){
				is_unique = false;
				break
			}
		}
		return is_unique
	}

};



module.exports = DB;