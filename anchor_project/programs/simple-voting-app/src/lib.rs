#![allow(unexpected_cfgs)]
#![allow(deprecated)]

use anchor_lang::prelude::*;

declare_id!("Ak88q7XogJ5Hq2uUG4oPvA95JzcE3t35BMDujfC4Rd5c");

#[program]
pub mod simple_voting_app {
    use super::*;

    pub fn initialize_poll(
        ctx: Context<InitializePoll>,
        poll_id: u64,
        description: String,
        poll_start: u64,
        poll_end: u64,
    ) -> Result<()> {
        let poll = &mut ctx.accounts.poll;

        poll.poll_id = poll_id;
        poll.description = description;
        poll.poll_start = poll_start;
        poll.poll_end = poll_end;
        poll.candidate_amount = 0;

        Ok(())
    }

    pub fn initialize_candidate(
        ctx: Context<InitializeCandidate>,
        candidate_name: String,
        poll_id: u64,
    ) -> Result<()> {
        let poll = &mut ctx.accounts.poll;
        poll.candidate_amount += 1;

        let candidate = &mut ctx.accounts.candidate;
        candidate.candidate_name = candidate_name;
        candidate.candidate_votes = 0;
        candidate.poll_id = poll_id;

        msg!("Candidate {} initialized", candidate.candidate_name);
        Ok(())
    }

    pub fn vote(ctx: Context<Vote>, _candidate_name: String, _poll_id: u64) -> Result<()> {
        let candidate = &mut ctx.accounts.candidate;
        candidate.candidate_votes += 1;

        msg!(
            "Voted for candidate: {}, which has {}",
            candidate.candidate_name,
            candidate.candidate_votes
        );

        Ok(())
    }
    
    pub fn delete_poll(ctx: Context<DeletePoll>, poll_id: u64) -> Result<()> {
        let poll = &ctx.accounts.poll;
        require!(poll.poll_id == poll_id, CustomError::PollIdMismatch);

        // Zero out votes for all candidate accounts passed in remaining_accounts
        for account_info in ctx.remaining_accounts.iter() {
            if account_info.owner == ctx.program_id {
                let mut data = account_info.data.borrow_mut();
                // candidate_votes is at offset 16..24 (after 8 bytes discriminator + 8 bytes poll_id)
                for i in 16..24 {
                    data[i] = 0;
                }
            }
        }
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(poll_id: u64)]
pub struct DeletePoll<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        close = signer,
        seeds = [poll_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub poll: Account<'info, Poll>,
    // Candidate accounts will be passed in remaining_accounts
}

#[error_code]
pub enum CustomError {
    #[msg("Poll ID mismatch")]
    PollIdMismatch,
}

#[derive(Accounts)]
#[instruction(candidate_name: String, poll_id: u64)]
pub struct Vote<'info> {
    #[account()]
    pub signer: Signer<'info>,

    #[account(
        seeds = [poll_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub poll: Account<'info, Poll>,

    #[account(
        mut,
        seeds = [candidate_name.as_ref(), poll_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub candidate: Account<'info, Candidate>,
}

#[derive(Accounts)]
// these must be in the same order as the instruction
// they define the seed of the account, so we can refer these from the seeds property
// in the account attribute.
#[instruction(candidate_name: String, poll_id: u64)] 
pub struct InitializeCandidate<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [poll_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub poll: Account<'info, Poll>,

    #[account(
        init, 
        payer = signer,
        space = 8 + Candidate::INIT_SPACE ,
        seeds = [candidate_name.as_ref(), poll_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub candidate: Account<'info, Candidate>,

    pub system_program: Program<'info, System>,
}


#[account]
#[derive(InitSpace)]
pub struct Candidate {
    pub poll_id: u64,
    pub candidate_votes: u64,
    // moving the dynamic data fields to the end for easier use of the filters later.
    // since anchor will use 36 bytes for this field, 4 bytes for the length and 32 bytes for the data.
    // but it will only use the length of the data, so no padding is applied.
    #[max_len(32)]
    pub candidate_name: String,
}

#[derive(Accounts)]
#[instruction(poll_id: u64)]
pub struct InitializePoll<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init, 
        payer = signer,
        space = 8 + Poll::INIT_SPACE ,
        seeds = [poll_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub poll: Account<'info, Poll>,

    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Poll {
    pub poll_id: u64,
    pub poll_start: u64,
    pub poll_end: u64,
    pub candidate_amount: u64,
    #[max_len(200)]
    pub description: String,
}
