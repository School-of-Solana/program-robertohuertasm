// Here we export some useful types and functions for interacting with the Anchor program.
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { Cluster, PublicKey } from '@solana/web3.js';
import SimpleVotingAppIDL from '../../anchor_project/target/idl/simple_voting_app.json';
import type { SimpleVotingApp } from '../../anchor_project/target/types/simple_voting_app';

// Re-export the generated IDL and type
export { SimpleVotingApp, SimpleVotingAppIDL };

// The programId is imported from the program IDL.
export const SIMPLE_VOTING_APP_PROGRAM_ID = new PublicKey(SimpleVotingAppIDL.address);

// This is a helper function to get the Counter Anchor program.
export function getSimpleVotingAppProgram(provider: AnchorProvider, address?: PublicKey) {
  return new Program(
    {
      ...SimpleVotingAppIDL,
      address: address ? address.toBase58() : SimpleVotingAppIDL.address,
    } as SimpleVotingApp,
    provider,
  );
}

export function getSimpleVotingAppProgramId(cluster: Cluster) {
  switch (cluster) {
    case 'devnet':
    case 'testnet':
      return new PublicKey('Ak88q7XogJ5Hq2uUG4oPvA95JzcE3t35BMDujfC4Rd5c');
    case 'mainnet-beta':
    default:
      return SIMPLE_VOTING_APP_PROGRAM_ID;
  }
}
