import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { SimpleVotingApp } from '../target/types/simple_voting_app';

describe('simple-voting-app.basic.test', () => {
  async function setup() {
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    // NOTE: Anchor will use the wallet as the default signer.
    const payer = provider.wallet;
    const program = anchor.workspace
      .SimpleVotingApp as Program<SimpleVotingApp>;

    return { provider, payer, program };
  }

  it('should initialize a poll', async () => {
    const { program } = await setup();

    const [pollAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, 'le', 8)],
      program.programId,
    );

    await program.methods
      .initializePoll(
        new anchor.BN(1),
        'What is your favourite color?',
        new anchor.BN(Date.now()),
        new anchor.BN(Date.now() + 1000000),
      )
      .rpc();

    const currentPoll = await program.account.poll.fetch(pollAddress);

    expect(currentPoll.pollId.eq(new anchor.BN(1))).toBeTruthy();
    expect(currentPoll.description).toEqual('What is your favourite color?');
    expect(currentPoll.candidateAmount.toNumber()).toEqual(0);
  });

  it('should initialize a candidate', async () => {
    const { program } = await setup();

    const [pollAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, 'le', 8)],
      program.programId,
    );

    let tx = await program.methods
      .initializeCandidate('Roberto', new anchor.BN(1))
      .accountsPartial({
        poll: pollAddress,
      })
      .rpc();

    tx = await program.methods
      .initializeCandidate('Nicolas', new anchor.BN(1))
      .accountsPartial({
        poll: pollAddress,
      })
      .rpc();

    const [robertoAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from('Roberto'), new anchor.BN(1).toArrayLike(Buffer, 'le', 8)],
      program.programId,
    );

    const [nicolasAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from('Nicolas'), new anchor.BN(1).toArrayLike(Buffer, 'le', 8)],
      program.programId,
    );

    const roberto = await program.account.candidate.fetch(robertoAddress);
    const nicolas = await program.account.candidate.fetch(nicolasAddress);

    const currentPoll = await program.account.poll.fetch(pollAddress);

    expect(roberto.candidateName).toEqual('Roberto');
    expect(roberto.candidateVotes.toNumber()).toEqual(0);
    expect(nicolas.candidateName).toEqual('Nicolas');
    expect(nicolas.candidateVotes.toNumber()).toEqual(0);
    expect(currentPoll.candidateAmount.toNumber()).toEqual(2);
  });

  it('should vote for a candidate', async () => {
    const { program } = await setup();

    const [pollAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, 'le', 8)],
      program.programId,
    );

    const [robertoAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from('Roberto'), new anchor.BN(1).toArrayLike(Buffer, 'le', 8)],
      program.programId,
    );

    await program.methods
      .vote('Roberto', new anchor.BN(1))
      .accountsPartial({
        poll: pollAddress,
        candidate: robertoAddress,
      })
      .rpc();

    const roberto = await program.account.candidate.fetch(robertoAddress);

    expect(roberto.candidateVotes.toNumber()).toEqual(1);
  });

  it('should fail to initialize a duplicate poll', async () => {
    const { program } = await setup();
    // First poll creation should succeed
    await program.methods
      .initializePoll(
        new anchor.BN(2),
        'Duplicate poll test',
        new anchor.BN(Date.now()),
        new anchor.BN(Date.now() + 1000000),
      )
      .rpc();
    // Second poll with same ID should fail
    let errorCaught = false;
    try {
      await program.methods
        .initializePoll(
          new anchor.BN(2),
          'Duplicate poll test',
          new anchor.BN(Date.now()),
          new anchor.BN(Date.now() + 1000000),
        )
        .rpc();
    } catch (e) {
      errorCaught = true;
    }
    expect(errorCaught).toBeTruthy();
  });

  it('should fail to initialize a duplicate candidate', async () => {
    const { program } = await setup();
    const [pollAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(3).toArrayLike(Buffer, 'le', 8)],
      program.programId,
    );
    await program.methods
      .initializePoll(
        new anchor.BN(3),
        'Candidate duplicate test',
        new anchor.BN(Date.now()),
        new anchor.BN(Date.now() + 1000000),
      )
      .rpc();
    // First candidate creation should succeed
    await program.methods
      .initializeCandidate('Alice', new anchor.BN(3))
      .accountsPartial({ poll: pollAddress })
      .rpc();
    // Second candidate with same name and poll should fail
    let errorCaught = false;
    try {
      await program.methods
        .initializeCandidate('Alice', new anchor.BN(3))
        .accountsPartial({ poll: pollAddress })
        .rpc();
    } catch (e) {
      errorCaught = true;
    }
    expect(errorCaught).toBeTruthy();
  });

  it('should fail to vote for a non-existent candidate', async () => {
    const { program } = await setup();
    const [pollAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(4).toArrayLike(Buffer, 'le', 8)],
      program.programId,
    );
    await program.methods
      .initializePoll(
        new anchor.BN(4),
        'Invalid vote test',
        new anchor.BN(Date.now()),
        new anchor.BN(Date.now() + 1000000),
      )
      .rpc();
    // Try to vote for a candidate that does not exist
    const [fakeCandidateAddress] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('FakeCandidate'),
        new anchor.BN(4).toArrayLike(Buffer, 'le', 8),
      ],
      program.programId,
    );
    let errorCaught = false;
    try {
      await program.methods
        .vote('FakeCandidate', new anchor.BN(4))
        .accountsPartial({
          poll: pollAddress,
          candidate: fakeCandidateAddress,
        })
        .rpc();
    } catch (e) {
      errorCaught = true;
    }
    expect(errorCaught).toBeTruthy();
  });

  it('should fail to vote for a non-existent poll', async () => {
    const { program } = await setup();
    // Try to vote for a poll that does not exist
    const [fakePollAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(999).toArrayLike(Buffer, 'le', 8)],
      program.programId,
    );
    const [fakeCandidateAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from('Ghost'), new anchor.BN(999).toArrayLike(Buffer, 'le', 8)],
      program.programId,
    );
    let errorCaught = false;
    try {
      await program.methods
        .vote('Ghost', new anchor.BN(999))
        .accountsPartial({
          poll: fakePollAddress,
          candidate: fakeCandidateAddress,
        })
        .rpc();
    } catch (e) {
      errorCaught = true;
    }
    expect(errorCaught).toBeTruthy();
  });

  it('should delete a poll and all its candidates', async () => {
    const { program, payer } = await setup();
    const pollId = new anchor.BN(100);
    const pollSeed = pollId.toArrayLike(Buffer, 'le', 8);
    const [pollAddress] = PublicKey.findProgramAddressSync(
      [pollSeed],
      program.programId,
    );

    // Create poll
    await program.methods
      .initializePoll(
        pollId,
        'Poll to be deleted',
        new anchor.BN(Date.now()),
        new anchor.BN(Date.now() + 1000000),
      )
      .rpc();

    // Add candidates
    await program.methods
      .initializeCandidate('DeleteMe1', pollId)
      .accountsPartial({ poll: pollAddress })
      .rpc();
    await program.methods
      .initializeCandidate('DeleteMe2', pollId)
      .accountsPartial({ poll: pollAddress })
      .rpc();

    // Find candidate addresses
    const [cand1Address] = PublicKey.findProgramAddressSync(
      [Buffer.from('DeleteMe1'), pollSeed],
      program.programId,
    );
    const [cand2Address] = PublicKey.findProgramAddressSync(
      [Buffer.from('DeleteMe2'), pollSeed],
      program.programId,
    );

    // Vote for candidates
    await program.methods
      .vote('DeleteMe1', pollId)
      .accountsPartial({ poll: pollAddress, candidate: cand1Address })
      .rpc();
    await program.methods
      .vote('DeleteMe2', pollId)
      .accountsPartial({ poll: pollAddress, candidate: cand2Address })
      .rpc();

    // Now delete poll and zero candidate votes
    await program.methods
      .deletePoll(pollId)
      .accountsPartial({
        signer: payer.publicKey,
        poll: pollAddress,
      })
      .remainingAccounts([
        { pubkey: cand1Address, isWritable: true, isSigner: false },
        { pubkey: cand2Address, isWritable: true, isSigner: false },
      ])
      .rpc();

    // Try to fetch poll, should fail
    let pollFetchError = false;
    try {
      await program.account.poll.fetch(pollAddress);
    } catch (e) {
      pollFetchError = true;
    }
    expect(pollFetchError).toBeTruthy();

    // Candidate accounts should still exist, but votes should be zero
    const cand1 = await program.account.candidate.fetch(cand1Address);
    const cand2 = await program.account.candidate.fetch(cand2Address);
    expect(cand1.candidateVotes.toNumber()).toEqual(0);
    expect(cand2.candidateVotes.toNumber()).toEqual(0);
  });
});
