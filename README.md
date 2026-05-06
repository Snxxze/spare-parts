# Spare Parts Requisition System

ระบบบริหารจัดการและเบิกจ่ายอะไหล่ (Spare Parts) พัฒนาด้วย React, TypeScript และ Supabase

## 🚀 ฟีเจอร์หลัก (Key Features)

- **Inventory Tracking**: ตรวจสอบรายการอะไหล่และจำนวนคงเหลือ
- **Requisition System**: ระบบเบิกอะไหล่สำหรับพนักงาน
- **Approval Workflow**: ระบบอนุมัติการเบิกโดยหัวหน้าคลังหรือเจ้าของโรงงาน
- **Automatic Sync**: เชื่อมต่อข้อมูลรายการอะไหล่จาก Google Sheets อัตโนมัติผ่าน Edge Functions
- **Reporting**: รายงานยอดเบิก, รายงานการเติมอะไหล่ และรายงานความเคลื่อนไหวของสต็อก

## 🛠 เทคโนโลยีที่ใช้ (Tech Stack)

- **Frontend**: React 18+, Vite, TypeScript
- **Styling**: Tailwind CSS, Lucide React (Icons)
- **UI Components**: Shadcn/UI (Radix UI)
- **State Management & Data Fetching**: TanStack Query (React Query)
- **Backend/Database**: Supabase (PostgreSQL, Auth, Edge Functions)
- **Edge Functions**: Deno (Runtime สำหรับฟังก์ชันหลังบ้าน)

## 📋 สิ่งที่ต้องมีก่อนเริ่ม (Prerequisites)

- **Node.js**: เวอร์ชัน 20 หรือสูงกว่า (แนะนำเวอร์ชัน LTS)
- **npm**: มาพร้อมกับ Node.js
- **Git**: สำหรับใช้ดึงโค้ดและจัดการเวอร์ชัน
- **VS Code Extension (แนะนำ)**:
  - [Deno](https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno) (สำหรับ Edge Functions)
  - [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)

## ⚙️ การติดตั้ง (Installation)

1. **Clone โปรเจกต์**
   ```bash
   git clone <your-repository-url>
   cd IE/frontend
   ```

2. **ติดตั้ง Dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **ตั้งค่า Environment Variables**
   สร้างไฟล์ `.env` ในโฟลเดอร์ `frontend` และกำหนดค่าดังนี้:
   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
   ```

4. **เริ่มรันโปรเจกต์ (Local Development)**
   ```bash
   npm run dev
   ```
   จากนั้นเข้าใช้งานได้ที่ [http://localhost:8080](http://localhost:8080)

## ☁️ Supabase Edge Functions

โปรเจกต์นี้มีฟังก์ชันหลังบ้าน 2 ตัวที่รันบน Supabase:

- **sync-parts**: ดึงข้อมูลรายการอะไหล่จาก Google Sheets มาอัปเดตลงฐานข้อมูล
- **get-roster**: ดึงข้อมูลทะเบียนพนักงานจาก Google Sheets (CSV) เพื่อตรวจสอบสิทธิ์

### การพัฒนา Edge Functions ใน VS Code
หากคุณเห็นเส้นแดงใต้คำว่า `Deno` ให้ติดตั้ง Extension **Deno** ใน VS Code และทำการ Enable สำหรับ Workspace นี้ (มีการตั้งค่าเตรียมไว้ให้แล้วใน `.vscode/settings.json`)

## 📂 โครงสร้างโฟลเดอร์ (Project Structure)

- `src/components`: UI Components และหน้า Tabs ต่างๆ
- `src/integrations/supabase`: การตั้งค่า Supabase Client และ Database Types
- `src/lib`: ฟังก์ชัน Utility ต่างๆ และระบบจัดการสิทธิ์พนักงาน
- `src/pages`: หน้าหลักของแอปพลิเคชัน (Dashboard, Auth, NotFound)
- `supabase/functions`: ซอร์สโค้ดของ Edge Functions (Deno)

---
จัดทำโดยทีมพัฒนา Spare Parts Requisition System
