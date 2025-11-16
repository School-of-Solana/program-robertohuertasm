'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletButton } from '../solana/solana-provider';
import { AppHero, ellipsify } from '../ui/ui-layout';
import { ExplorerLink } from '../cluster/cluster-ui';
import { useSimpleVotingAppProgram } from './voting-data-access';
import { SimpleVotingAppCreate, SimpleVotingAppList } from './voting-ui';

export default function VotingFeature() {
  const { publicKey } = useWallet();
  const { programId } = useSimpleVotingAppProgram();

  return publicKey ? (
    <div>
      <AppHero
        title="Simple Voting App"
        subtitle={
          'Create a new poll by clicking the "Create" button. The state of a poll is stored on-chain and can be manipulated by calling the program\'s methods.'
        }
      >
        <p className="mb-6">
          <ExplorerLink path={`account/${programId}`} label={ellipsify(programId.toString())} />
        </p>
        <SimpleVotingAppCreate />
      </AppHero>
      <SimpleVotingAppList />
    </div>
  ) : (
    <div className="max-w-4xl mx-auto">
      <div className="hero py-[64px]">
        <div className="hero-content text-center">
          <WalletButton />
        </div>
      </div>
    </div>
  );
}
