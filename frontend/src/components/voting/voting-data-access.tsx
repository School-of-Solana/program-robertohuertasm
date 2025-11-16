'use client';

import { getSimpleVotingAppProgram, getSimpleVotingAppProgramId } from '../../exports';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Cluster, PublicKey } from '@solana/web3.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useCluster } from '../cluster/cluster-data-access';
import { useAnchorProvider } from '../solana/solana-provider';
import { useTransactionToast } from '../ui/ui-layout';
import BN from 'bn.js';
import { utils } from '@coral-xyz/anchor';

const POLLID = 1;

const pollIdToBase58 = (pollId: BN): string => {
  const buffer = Buffer.from(pollId.toArray('le', 8));
  const bytes = utils.bytes.bs58.encode(buffer);
  return bytes;
};

export function useSimpleVotingAppProgram() {
  const { connection } = useConnection();
  const { cluster } = useCluster();
  const provider = useAnchorProvider();
  const queryClient = useQueryClient();

  const invalidatePollQuery = useCallback(
    (pollAddress: PublicKey) => {
      queryClient.invalidateQueries({
        queryKey: ['simple-voting-app', 'pollQuery', { cluster, pollAddress }],
        exact: true,
      });
    },
    [queryClient, cluster],
  );

  const programId = useMemo(() => getSimpleVotingAppProgramId(cluster.network as Cluster), [cluster]);

  const program = useMemo(() => getSimpleVotingAppProgram(provider, programId), [provider, programId]);

  const polls = useQuery({
    queryKey: ['simple-voting-app', 'all', { cluster }],
    queryFn: () => program.account.poll.all(),
  });

  const programAccount = useQuery({
    queryKey: ['get-program-account', { cluster }],
    queryFn: () => connection.getParsedAccountInfo(programId),
  });

  return {
    program,
    programId,
    programAccount,
    polls,
    invalidatePollQuery,
  };
}

export function useInitializePollAndCandidates() {
  const { program, polls, invalidatePollQuery } = useSimpleVotingAppProgram();
  const transactionToast = useTransactionToast();
  const [isPending, setIsPending] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const initializePoll = useMutation({
    mutationKey: ['simple-voting-app', 'initialize_poll'],
    mutationFn: () =>
      program.methods
        .initializePoll(
          new BN(POLLID),
          'What is your favourite color?',
          new BN(Date.now()),
          new BN(Date.now() + 10000000),
        )
        .rpc(),
    onSuccess: (signature) => {
      transactionToast(signature);
      return polls.refetch();
    },
  });

  const initializeCandidates = useMutation({
    mutationKey: ['simple-voting-app', 'initialize_candidates'],
    mutationFn: ({ name, pollId }: { name: string; pollId: number }) =>
      program.methods.initializeCandidate(name, new BN(pollId)).rpc(),
    onSuccess: (signature) => {
      transactionToast(signature);
      return polls.refetch();
    },
  });

  const initializePollAndCandidates = useCallback(async () => {
    setIsPending(true);
    try {
      // Initialize the poll
      const pollSignature = await initializePoll.mutateAsync();
      console.log('Poll initialized:', pollSignature);

      const newPoll = await program.account.poll.all([
        {
          memcmp: {
            offset: 8,
            bytes: pollIdToBase58(new BN(POLLID)),
          },
        },
      ]);

      // Initialize candidates sequentially
      const candidateNames = ['Red', 'Green'];
      for (const name of candidateNames) {
        const candidateSignature = await initializeCandidates.mutateAsync({
          name,
          pollId: POLLID,
        });
        console.log(`Candidate ${name} initialized:`, candidateSignature);
      }

      invalidatePollQuery(newPoll[0].publicKey);
    } catch (error) {
      console.error('Error initializing poll and candidates:', error);
    } finally {
      setIsPending(false);
      setIsInitialized(true);
    }
  }, [initializePoll, initializeCandidates, invalidatePollQuery, program.account.poll]);

  return { initializePollAndCandidates, isPending, isInitialized };
}

export function useSimpleVotingAppProgramAccount({ pollAddress }: { pollAddress: PublicKey }) {
  const { cluster } = useCluster();
  const transactionToast = useTransactionToast();
  const { program } = useSimpleVotingAppProgram();

  const pollQuery = useQuery({
    queryKey: ['simple-voting-app', 'pollQuery', { cluster, pollAddress }],
    queryFn: async () => {
      const poll = await program.account.poll.fetch(pollAddress);

      const candidates = await program.account.candidate.all([
        {
          memcmp: {
            offset: 8,
            bytes: pollIdToBase58(poll.pollId),
          },
        },
      ]);

      return {
        poll,
        candidates,
      };
    },
  });

  // program.provider.connection
  //   .getAccountInfo(
  //     new PublicKey('DnRiLFyEvtaSYj6bMS45nbVZnpUdgfu1WM97MdaoYkSc'),
  //   )
  //   .then((accountInfo) => {
  //     console.log(accountInfo);
  //     const rawData = accountInfo?.data.toString('hex');
  //     console.log('Raw account data (hex):', rawData);
  //   });

  const voteMutation = useMutation({
    mutationKey: ['simple-voting-app', 'vote', { cluster, pollAddress }],
    mutationFn: ({ name, pollId, candidateAddress }: { name: string; pollId: BN; candidateAddress: PublicKey }) =>
      program.methods
        .vote(name, pollId)
        // the accounts are not needed but...
        .accountsPartial({ poll: pollAddress, candidate: candidateAddress })
        .rpc(),
    onSuccess: (tx) => {
      transactionToast(tx);
      return pollQuery.refetch();
    },
  });

  return {
    pollQuery,
    voteMutation,
  };
}

export function useDeletePoll() {
  const { program, polls, invalidatePollQuery } = useSimpleVotingAppProgram();
  const transactionToast = useTransactionToast();
  const { publicKey } = useWallet();

  return useMutation({
    mutationKey: ['simple-voting-app', 'delete_poll'],
    mutationFn: async ({
      pollId,
      pollAddress,
      candidateAddresses,
    }: {
      pollId: number | BN;
      pollAddress: PublicKey;
      candidateAddresses: PublicKey[];
    }) => {
      if (!publicKey) throw new Error('Wallet not connected');
      const pollIdBN = BN.isBN(pollId) ? pollId : new BN(pollId);
      const remainingAccounts = candidateAddresses.map((address) => ({
        pubkey: address,
        isWritable: true,
        isSigner: false,
      }));
      const tx = await program.methods
        .deletePoll(pollIdBN)
        .accountsPartial({
          signer: publicKey,
          poll: pollAddress,
        })
        .remainingAccounts(remainingAccounts)
        .rpc();
      return tx;
    },
    onSuccess: (tx, { pollAddress }) => {
      transactionToast(tx);
      invalidatePollQuery(pollAddress);
      return polls.refetch();
    },
  });
}
