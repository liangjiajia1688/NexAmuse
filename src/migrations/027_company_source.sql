-- 027: 招商线索(lead)支持 —— companies 表增加来源标记 source
ALTER TABLE companies ADD COLUMN source TEXT;
