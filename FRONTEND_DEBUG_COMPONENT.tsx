// Debug Component to Test Wallet Funding
// Add this to your app temporarily to debug the issue

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const WalletDebugComponent = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runDebugTests = async () => {
    setLoading(true);
    const results: any = {};

    try {
      // Test 1: Check authentication
      results.auth = {
        user: user,
        userId: user?.id,
        isAuthenticated: !!user
      };

      // Test 2: Check wallets
      const { data: wallets, error: walletsError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user?.id || '');

      results.wallets = {
        data: wallets,
        error: walletsError,
        count: wallets?.length || 0
      };

      // Test 3: Check if IntaSend function exists and works
      if (wallets && wallets.length > 0) {
        const kesWallet = wallets.find(w => w.currency === 'KES');
        
        if (kesWallet) {
          const { data: functionResult, error: functionError } = await supabase.rpc(
            'mpesa_fund_wallet',
            {
              wallet_id: kesWallet.id,
              phone_number: '254712345678',
              amount: 100
            }
          );

          results.functionTest = {
            walletId: kesWallet.id,
            result: functionResult,
            error: functionError
          };
        } else {
          results.functionTest = {
            error: 'No KES wallet found'
          };
        }
      }

      // Test 4: Check database connection
      const { data: dbTest, error: dbError } = await supabase
        .from('wallets')
        .select('count')
        .limit(1);

      results.dbConnection = {
        connected: !dbError,
        error: dbError
      };

      setDebugInfo(results);

    } catch (error) {
      results.generalError = error;
      setDebugInfo(results);
    } finally {
      setLoading(false);
    }
  };

  const createKESWallet = async () => {
    if (!user) {
      toast({
        title: 'Not Authenticated',
        description: 'Please log in first',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('wallets')
        .insert({
          user_id: user.id,
          currency: 'KES',
          balance: 0,
          wallet_number: `WLT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          type: 'fiat',
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'KES Wallet Created',
        description: `Wallet ${data.wallet_number} created successfully`
      });

      // Refresh debug info
      runDebugTests();

    } catch (error: any) {
      toast({
        title: 'Error Creating Wallet',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Wallet Funding Debug</h2>
      
      <div className="space-y-4">
        <Button onClick={runDebugTests} disabled={loading}>
          {loading ? 'Running Tests...' : 'Run Debug Tests'}
        </Button>

        <Button onClick={createKESWallet} variant="outline">
          Create KES Wallet
        </Button>

        {debugInfo && (
          <div className="bg-gray-100 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Debug Results:</h3>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletDebugComponent;