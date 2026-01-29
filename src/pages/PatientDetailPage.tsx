import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus, User, FileText } from 'lucide-react';
import { calculateAge } from '@/lib/utils';

const mockPatient = {
  id: 1, patient_id: 'P-20260101-001', first_name: '三', last_name: '张', gender: 'male',
  date_of_birth: '1985-03-15', phone: '13800138001', notes: '过敏史：青霉素', created_at: '2026-01-01',
};

const mockSamples = [
  { id: 1, sample_id: 'S-20260128-001', tests: 'CBC, CMP', status: 'completed', collected_at: '2026-01-28 09:15', results_count: 18 },
  { id: 2, sample_id: 'S-20260115-003', tests: 'Lipid Panel', status: 'completed', collected_at: '2026-01-15 10:30', results_count: 4 },
];

const genderLabels: Record<string, string> = { male: '男', female: '女', other: '其他' };

export function PatientDetailPage() {
  const patient = mockPatient;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/patients"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{patient.last_name}{patient.first_name}</h1>
          <p className="text-gray-500">{patient.patient_id}</p>
        </div>
        <Link to={`/orders/new?patient=${patient.id}`}><Button><Plus className="h-4 w-4 mr-2" />新建检验</Button></Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />基本信息</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-2xl font-bold text-blue-600">{patient.last_name[0]}</span>
              </div>
              <div>
                <p className="text-lg font-medium">{patient.last_name}{patient.first_name}</p>
                <p className="text-sm text-gray-500">{patient.patient_id}</p>
              </div>
            </div>
            <div className="space-y-3 pt-4 border-t">
              <div className="flex justify-between"><span className="text-gray-500">性别</span><span>{genderLabels[patient.gender]}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">年龄</span><span>{calculateAge(patient.date_of_birth)} 岁</span></div>
              <div className="flex justify-between"><span className="text-gray-500">电话</span><span>{patient.phone}</span></div>
            </div>
            {patient.notes && <div className="pt-4 border-t"><p className="text-sm text-gray-500 mb-1">备注</p><p className="text-sm bg-yellow-50 p-2 rounded">{patient.notes}</p></div>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />检验历史</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>样本 ID</TableHead>
                  <TableHead>检验项目</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>采集时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockSamples.map((sample) => (
                  <TableRow key={sample.id}>
                    <TableCell className="font-mono">{sample.sample_id}</TableCell>
                    <TableCell>{sample.tests}</TableCell>
                    <TableCell><Badge variant="success">已完成</Badge></TableCell>
                    <TableCell>{sample.collected_at}</TableCell>
                    <TableCell className="text-right"><Button variant="outline" size="sm">查看报告</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
