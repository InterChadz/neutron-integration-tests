use crate::state::Transfer;
use cosmwasm_std::Binary;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InstantiateMsg {}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    RegisterBalanceQuery {
        zone_id: String,
        connection_id: String,
        update_period: u64,
        addr: String,
        denom: String,
    },
    RegisterTransfersQuery {
        zone_id: String,
        connection_id: String,
        update_period: u64,
        recipient: String,
    },
    RegisterDelegatorDelegationsQuery {
        delegator: String,
        validators: Vec<String>,
        zone_id: String,
        connection_id: String,
        update_period: u64,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    Balance { query_id: u64 },
    GetDelegations { query_id: u64 },
    GetRegisteredQuery { query_id: u64 },
    GetRecipientTxs { recipient: String },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct GetRecipientTxsResponse {
    pub transfers: Vec<Transfer>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum SudoMsg {
    TxQueryResult {
        query_id: u64,
        height: u64,
        data: Binary,
    },
    #[serde(rename = "kv_query_result")]
    KVQueryResult { query_id: u64 },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct MigrateMsg {}
