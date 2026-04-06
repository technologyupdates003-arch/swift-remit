import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Shield, Upload, CheckCircle, Clock, XCircle } from 'lucide-react';

interface KycDoc {
  id: string;
  document_type: string;
  file_url: string;
  status: string;
  created_at: string;
  admin_notes: string | null;
}

const KycPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [docs, setDocs] = useState<KycDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('kyc_documents').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => { setDocs(data || []); setLoading(false); });
  }, [user]);

  const handleUpload = async () => {
    if (!file || !docType || !user) return;
    setUploading(true);
    const filePath = `${user.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('kyc-documents').upload(filePath, file);
    if (uploadError) {
      toast({ title: 'Upload failed', variant: 'destructive' });
      setUploading(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('kyc-documents').getPublicUrl(filePath);
    const { error } = await supabase.from('kyc_documents').insert({
      user_id: user.id,
      document_type: docType,
      file_url: publicUrl,
    });
    setUploading(false);
    if (error) {
      toast({ title: 'Failed to save document', variant: 'destructive' });
    } else {
      toast({ title: 'Document uploaded for review' });
      setFile(null);
      setDocType('');
      supabase.from('kyc_documents').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
        .then(({ data }) => setDocs(data || []));
    }
  };

  const statusIcon = (status: string) => {
    if (status === 'approved') return <CheckCircle className="w-4 h-4 text-primary" />;
    if (status === 'rejected') return <XCircle className="w-4 h-4 text-destructive" />;
    return <Clock className="w-4 h-4 text-warning" />;
  };

  return (
    <div className="space-y-6 max-w-md mx-auto">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">KYC Verification</h1>
      </div>

      <div className="border border-border rounded-xl p-5 bg-card space-y-4">
        <p className="text-sm font-medium text-foreground">Upload Document</p>
        <Select value={docType} onValueChange={setDocType}>
          <SelectTrigger><SelectValue placeholder="Document type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="national_id">National ID</SelectItem>
            <SelectItem value="passport">Passport</SelectItem>
            <SelectItem value="drivers_license">Driver's License</SelectItem>
          </SelectContent>
        </Select>
        <Input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <Button onClick={handleUpload} disabled={!file || !docType || uploading} className="w-full">
          <Upload className="w-4 h-4 mr-2" />{uploading ? 'Uploading...' : 'Upload'}
        </Button>
      </div>

      {docs.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Submitted Documents</p>
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
              {statusIcon(doc.status)}
              <div className="flex-1">
                <p className="text-sm font-medium capitalize text-foreground">{doc.document_type.replace('_', ' ')}</p>
                <p className="text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleDateString()}</p>
              </div>
              <span className={`text-xs font-medium capitalize ${doc.status === 'approved' ? 'text-primary' : doc.status === 'rejected' ? 'text-destructive' : 'text-warning'}`}>
                {doc.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default KycPage;
