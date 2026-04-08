import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, CheckCircle, Building2, Shield, AlertCircle } from 'lucide-react';

interface BankAccount {
  id: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  bank_code: string;
  currency: string;
  is_verified: boolean;
  is_default: boolean;
}

interface BankAccountManagerProps {
  onAccountSelect?: (account: BankAccount) => void;
  selectedAccountId?: string;
}

const BankAccountManager = ({ onAccountSelect, selectedAccountId }: BankAccountManagerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    account_name: '',
    account_number: '',
    bank_code: '',
    bank_name: '',
  });
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);

  // Nigerian banks (expanded list)
  const banks = [
    { code: '044', name: 'Access Bank' },
    { code: '014', name: 'Afribank' },
    { code: '023', name: 'Citibank' },
    { code: '050', name: 'Ecobank' },
    { code: '011', name: 'First Bank' },
    { code: '214', name: 'First City Monument Bank' },
    { code: '070', name: 'Fidelity Bank' },
    { code: '058', name: 'Guaranty Trust Bank' },
    { code: '030', name: 'Heritage Bank' },
    { code: '301', name: 'Jaiz Bank' },
    { code: '082', name: 'Keystone Bank' },
    { code: '221', name: 'Stanbic IBTC Bank' },
    { code: '068', name: 'Standard Chartered Bank' },
    { code: '232', name: 'Sterling Bank' },
    { code: '032', name: 'Union Bank' },
    { code: '033', name: 'United Bank for Africa' },
    { code: '215', name: 'Unity Bank' },
    { code: '035', name: 'Wema Bank' },
    { code: '057', name: 'Zenith Bank' },
    { code: '076', name: 'Polaris Bank' },
    { code: '039', name: 'Stanbic IBTC Bank' },
    { code: '101', name: 'Providus Bank' },
    { code: '100', name: 'Suntrust Bank' },
  ];

  const fetchAccounts = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch bank accounts',
        variant: 'destructive',
      });
    } else {
      setAccounts(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
  }, [user]);

  const verifyAccount = async () => {
    if (!formData.account_number || !formData.bank_code) {
      toast({
        title: 'Missing Information',
        description: 'Please enter account number and select a bank',
        variant: 'destructive',
      });
      return;
    }

    if (formData.account_number.length !== 10) {
      toast({
        title: 'Invalid Account Number',
        description: 'Nigerian account numbers must be exactly 10 digits',
        variant: 'destructive',
      });
      return;
    }

    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('withdraw-to-bank', {
        body: {
          action: 'verify_account',
          account_number: formData.account_number,
          bank_code: formData.bank_code,
        },
      });

      if (error) throw error;

      if (data.status) {
        setFormData(prev => ({
          ...prev,
          account_name: data.data.account_name,
        }));
        toast({
          title: 'Account Verified',
          description: `Account belongs to ${data.data.account_name}`,
        });
      } else {
        throw new Error(data.message || 'Account verification failed');
      }
    } catch (error: any) {
      toast({
        title: 'Verification Failed',
        description: error.message || 'Could not verify account. Please check your details.',
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
    }
  };

  const saveAccount = async () => {
    if (!formData.account_name || !formData.account_number || !formData.bank_code) {
      toast({
        title: 'Missing Information',
        description: 'Please verify your account first',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const selectedBank = banks.find(b => b.code === formData.bank_code);
      
      const { error } = await supabase
        .from('bank_accounts')
        .insert({
          user_id: user?.id,
          account_name: formData.account_name,
          account_number: formData.account_number,
          bank_code: formData.bank_code,
          bank_name: selectedBank?.name || '',
          currency: 'NGN',
          is_verified: true,
          is_default: accounts.length === 0, // First account is default
        });

      if (error) throw error;

      toast({
        title: 'Account Added Successfully',
        description: 'Your bank account has been saved and verified',
      });

      setDialogOpen(false);
      setFormData({
        account_name: '',
        account_number: '',
        bank_code: '',
        bank_name: '',
      });
      fetchAccounts();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add bank account',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async (accountId: string) => {
    try {
      const { error } = await supabase
        .from('bank_accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;

      toast({
        title: 'Account Removed',
        description: 'Bank account has been deleted successfully',
      });
      fetchAccounts();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete account',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <div className="animate-pulse h-20 bg-muted rounded-lg"></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          Bank Accounts
        </h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Add Bank Account
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {/* Security Notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-blue-900">Secure Account Verification</p>
                    <p className="text-xs text-blue-800">
                      We'll verify your account details with your bank to ensure security
                    </p>
                  </div>
                </div>
              </div>

              {/* Bank Selection */}
              <div className="space-y-2">
                <Label htmlFor="bank">Select Your Bank</Label>
                <Select
                  value={formData.bank_code}
                  onValueChange={(value) => {
                    const bank = banks.find(b => b.code === value);
                    setFormData(prev => ({
                      ...prev,
                      bank_code: value,
                      bank_name: bank?.name || '',
                      account_name: '', // Reset account name when bank changes
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose your bank" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {banks.map((bank) => (
                      <SelectItem key={bank.code} value={bank.code}>
                        {bank.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Account Number */}
              <div className="space-y-2">
                <Label htmlFor="account_number">Account Number</Label>
                <div className="flex gap-2">
                  <Input
                    id="account_number"
                    placeholder="Enter 10-digit account number"
                    value={formData.account_number}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setFormData(prev => ({
                        ...prev,
                        account_number: value,
                        account_name: '', // Reset account name when number changes
                      }));
                    }}
                    maxLength={10}
                    className="font-mono"
                  />
                  <Button
                    onClick={verifyAccount}
                    disabled={verifying || formData.account_number.length !== 10 || !formData.bank_code}
                    size="sm"
                    className="whitespace-nowrap"
                  >
                    {verifying ? (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Verifying...
                      </div>
                    ) : (
                      'Verify'
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter your 10-digit account number
                </p>
              </div>

              {/* Verified Account Name */}
              {formData.account_name && (
                <div className="space-y-2">
                  <Label htmlFor="account_name">Account Name (Verified)</Label>
                  <div className="relative">
                    <Input
                      id="account_name"
                      value={formData.account_name}
                      disabled
                      className="bg-green-50 border-green-200 text-green-800 font-medium pr-10"
                    />
                    <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    setFormData({
                      account_name: '',
                      account_number: '',
                      bank_code: '',
                      bank_name: '',
                    });
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveAccount}
                  disabled={saving || !formData.account_name}
                  className="flex-1"
                >
                  {saving ? (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </div>
                  ) : (
                    'Save Account'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-muted-foreground/25 rounded-lg">
          <Building2 className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No bank accounts added yet</p>
          <p className="text-sm text-muted-foreground">Add a bank account to enable withdrawals</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className={`border-2 rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                selectedAccountId === account.id
                  ? 'border-primary bg-primary/5 shadow-md'
                  : 'border-border hover:border-primary/50 hover:shadow-sm'
              }`}
              onClick={() => onAccountSelect?.(account)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-foreground">{account.account_name}</p>
                    {account.is_verified && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                    {account.is_default && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full font-medium">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {account.bank_name}
                  </p>
                  <p className="text-sm font-mono text-muted-foreground">
                    {account.account_number}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Are you sure you want to delete this bank account?')) {
                      deleteAccount(account.id);
                    }
                  }}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BankAccountManager;