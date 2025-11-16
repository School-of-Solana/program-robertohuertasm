# Project Description

**Deployed Frontend URL:** [LINK](https://simple-voting-app-seven.vercel.app)

**Solana Program ID:** Ak88q7XogJ5Hq2uUG4oPvA95JzcE3t35BMDujfC4Rd5c (DEVNET)

## Project Overview

### Description
A decentralized voting application built on Solana. Users can create polls, add candidates, and vote for their preferred candidate. All poll and candidate data is stored on-chain using Program Derived Addresses (PDAs) for deterministic and secure account management.

### Key Features
 - **Create Poll**: Initialize a new poll with a description and voting time window.
 - **Add Candidate**: Add candidates to a poll.
 - **Vote**: Cast votes for candidates in a poll.
 - **Delete Poll**: Remove a poll and zero all candidate votes (candidate accounts remain on-chain, but votes are reset).
 - **View Results**: Display poll details and candidate vote counts.

### How to Use the dApp
1. **Connect Wallet** - Connect your Solana wallet.
2. **Create Poll** - Set up a poll with a description and time window.
3. **Add Candidates** - Add candidates to your poll.
4. **Vote** - Cast your vote for a candidate in a poll.
5. **Delete Poll** - Remove a poll and its candidates using the Delete button in the UI. Candidate votes will be zeroed, but accounts remain.
6. **View Results** - See poll and candidate statistics.

## Program Architecture
The voting app uses PDAs to manage poll and candidate accounts. Each poll and candidate is uniquely identified and stored on-chain.

### PDA Usage
- **Poll PDA**: Derived from `[poll_id]` (as little-endian bytes).
- **Candidate PDA**: Derived from `[candidate_name, poll_id]`.

### Program Instructions
 - **initialize_poll**: Creates a new poll.
 - **initialize_candidate**: Adds a candidate to a poll.
 - **vote**: Casts a vote for a candidate.
 - **delete_poll**: Deletes a poll and zeroes all candidate votes. Candidate accounts are not closed, but their votes are reset to zero. (Direct data modification is used for arbitrary-length candidate lists, as Anchor does not support dynamic account lists in instruction context.)

### Account Structure

```rust
#[account]
pub struct Poll {
    pub poll_id: u64,           // Unique identifier for the poll (used as PDA seed)
    pub poll_start: u64,        // Unix timestamp when the poll starts
    pub poll_end: u64,          // Unix timestamp when the poll ends
    pub candidate_amount: u64,  // Number of candidates in the poll
    pub description: String,    // Description of the poll/question
}

#[account]
pub struct Candidate {
    pub poll_id: u64,           // The poll this candidate belongs to (used as PDA seed)
    pub candidate_votes: u64,   // Number of votes received by this candidate
    pub candidate_name: String, // Candidate's name (used as PDA seed)
}
```

## Testing

### Test Coverage

Comprehensive test suite covering poll creation, candidate addition, voting, poll deletion, and error scenarios to ensure program reliability.

**Happy Path Tests:**
 - **Initialize Poll**: Successfully creates a poll with correct initial values.
 - **Initialize Candidate**: Properly adds candidates to a poll.
 - **Vote**: Correctly increments candidate vote count.
 - **Delete Poll**: Successfully deletes a poll and zeroes all candidate votes. Candidate accounts remain, but their votes are reset.

**Unhappy Path Tests:**
 - **Duplicate Poll/Candidate**: Fails when trying to create a poll or candidate that already exists.
 - **Invalid Vote**: Fails when voting for a non-existent candidate or poll.
 - **Delete Non-existent Poll**: Fails when trying to delete a poll that does not exist.

### Running Tests
```bash
yarn install    # install dependencies
anchor test     # run tests, includes bankrun
cargo test-sbf  # run Rust tests
```

### Additional Notes for Evaluators

This project demonstrates on-chain voting logic using Solana and Anchor. PDAs are used for secure and deterministic account management. The main challenges were designing the PDA structure, ensuring correct account initialization and access control, and implementing robust poll deletion. Due to Anchor's limitations with dynamic account lists, candidate votes are zeroed via direct data modification when deleting a poll, rather than closing candidate accounts.

The happy path tests are replicated using:
- bankrun
- cargo test-sbf
- normal anchor tests
