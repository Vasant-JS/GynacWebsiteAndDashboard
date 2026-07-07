import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/browser_client.dart';
import 'package:url_launcher/url_launcher.dart';

void main() => runApp(const AuraDashboardApp());

const _primary = Color(0xFFB0004A);
const _navy = Color(0xFF000767);
const _teal = Color(0xFF00796B);
const _mint = Color(0xFF75E7DC);
const _surface = Color(0xFFFBF8FF);
const _side = Color(0xFFEDEDFF);
const _panel = Color(0xFFF4F1FF);
const _line = Color(0xFFE3BDC3);
const _textMuted = Color(0xFF5A4044);
const _dummyMode = false;

enum DashboardRole { patient, doctor }

class AuraDashboardApp extends StatelessWidget {
  const AuraDashboardApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Aura Health Dashboard',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: _primary),
        scaffoldBackgroundColor: _surface,
        fontFamily: 'Arial',
        useMaterial3: true,
      ),
      home: const DashboardHome(),
    );
  }
}

class DashboardHome extends StatefulWidget {
  const DashboardHome({super.key});

  @override
  State<DashboardHome> createState() => _DashboardHomeState();
}

class _DashboardHomeState extends State<DashboardHome> {
  final _api = ApiClient();
  DashboardRole _role = DashboardRole.patient;
  Future<Map<String, dynamic>>? _data;

  @override
  void initState() {
    super.initState();
    if (Uri.base.queryParameters['role']?.toLowerCase() == 'doctor') {
      _role = DashboardRole.doctor;
    }
    _load();
  }

  void _load() {
    setState(() {
      if (_dummyMode) {
        _data = Future.value(dummyData(_role));
      } else {
        _data = _role == DashboardRole.patient
            ? _api.getJson('/api/patient/dashboard')
            : _api.getJson('/api/doctor/dashboard');
      }
    });
  }

  void _setRole(DashboardRole role) {
    if (_role == role) return;
    setState(() => _role = role);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth >= 920;
        return Scaffold(
          body: Row(
            children: [
              if (wide)
                SourceSidebar(
                  role: _role,
                  onRoleChanged: _setRole,
                ),
              Expanded(
                child: FutureBuilder<Map<String, dynamic>>(
                  future: _data,
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return const Center(child: CircularProgressIndicator(color: _primary));
                    }
                    final data = snapshot.data ?? dummyData(_role);
                    return Column(
                      children: [
                        SourceTopBar(
                          role: _role,
                          wide: wide,
                          onRoleChanged: _setRole,
                        ),
                        Expanded(
                          child: _role == DashboardRole.patient
                              ? PatientDashboard(data: data)
                              : DoctorDashboard(data: data),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class ApiClient {
  final BrowserClient _client = BrowserClient()..withCredentials = true;

  Future<Map<String, dynamic>> getJson(String path) async {
    final response = await _client.get(Uri.parse(path), headers: {'Accept': 'application/json'});
    final decoded = response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400) {
      throw Exception(decoded['message'] ?? 'Request failed');
    }
    return decoded;
  }
}

class SourceSidebar extends StatelessWidget {
  const SourceSidebar({super.key, required this.role, required this.onRoleChanged});

  final DashboardRole role;
  final ValueChanged<DashboardRole> onRoleChanged;

  @override
  Widget build(BuildContext context) {
    final patient = role == DashboardRole.patient;
    return Container(
      width: patient ? 320 : 250,
      color: _side,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(patient ? 20 : 40, 36, 20, 28),
            child: patient ? const PatientBrand() : const DoctorBrand(),
          ),
          if (!patient) const DoctorMiniProfile(),
          if (patient) ...[
            SidebarItem(icon: Icons.grid_view_rounded, label: 'Dashboard', active: true, onTap: () => onRoleChanged(DashboardRole.patient)),
            const SidebarItem(icon: Icons.calendar_today_outlined, label: 'Appointments'),
            const SidebarItem(icon: Icons.description_outlined, label: 'Medical Reports'),
            const SidebarItem(icon: Icons.person_outline, label: 'Profile'),
          ] else ...[
            const SidebarItem(icon: Icons.fact_check_outlined, label: 'Clinic Overview', active: true),
            const SidebarItem(icon: Icons.event_note_outlined, label: 'Daily Schedule'),
            const SidebarItem(icon: Icons.groups_outlined, label: 'Patient Registry'),
            const SidebarItem(icon: Icons.schedule_outlined, label: 'Slot Management'),
          ],
          const Spacer(),
          Padding(
            padding: const EdgeInsets.all(20),
            child: SizedBox(
              width: double.infinity,
              height: 58,
              child: FilledButton.icon(
                onPressed: patient ? () {} : () => BrowserNavigation.go('/api/auth/logout'),
                icon: Icon(patient ? Icons.add : Icons.logout),
                label: Text(patient ? 'Book New Consultation' : 'Sign Out'),
                style: FilledButton.styleFrom(
                  backgroundColor: _primary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(patient ? 10 : 4)),
                  textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class PatientBrand extends StatelessWidget {
  const PatientBrand({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const CircleAvatar(radius: 30, backgroundColor: Colors.white, child: Icon(Icons.receipt_long, color: _navy)),
        const SizedBox(width: 14),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: const [
            Text('Patient Portal', style: TextStyle(color: _navy, fontSize: 30, fontWeight: FontWeight.w800)),
            SizedBox(height: 4),
            Text('Welcome back, Sarah', style: TextStyle(color: _textMuted, fontSize: 17)),
          ],
        ),
      ],
    );
  }
}

class DoctorBrand extends StatelessWidget {
  const DoctorBrand({super.key});

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Aura\nHealth', style: TextStyle(color: _primary, fontSize: 29, height: 1.25, fontWeight: FontWeight.w900)),
        SizedBox(height: 4),
        Text('Physician\nDashboard', style: TextStyle(color: _textMuted, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
      ],
    );
  }
}

class DoctorMiniProfile extends StatelessWidget {
  const DoctorMiniProfile({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(40, 20, 20, 22),
      child: Row(
        children: [
          const CircleAvatar(radius: 27, backgroundImage: NetworkImage('https://lh3.googleusercontent.com/aida-public/AB6AXuD7KhyKhyojeW4Kg2ILL_NhRYOkeuefEeXQkS-E7buHZK5mhv-IysbsSheG4IikZpNlqhC3jszoW-Q5iAK3zKooINVXtVDcc4ZWCypya-1RN_STA-uvwURtEZ_revzXQrLBBHmHNbOwWfHDtJrbMcPR0rvbbDoTzI8VTR25WqKoZdfVVcF62R2KchEp2t5Te-46YW1xYbIhQJRhwKnejnF-5Bog_iydzVhQHEpy9gUCm-puVTsjYBfJ8DzoL-Cpq8zdSRh6jcBnRrk')),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text('Dr. Elena\nRossi', style: TextStyle(color: _navy, fontWeight: FontWeight.w900, fontSize: 20, height: 1.25)),
                SizedBox(height: 4),
                Text('Chief\nGynecologist', style: TextStyle(color: Color(0xFF3B1B24), fontSize: 15, height: 1.25)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class SidebarItem extends StatelessWidget {
  const SidebarItem({super.key, required this.icon, required this.label, this.active = false, this.onTap});

  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: onTap,
        child: Container(
          height: 60,
          margin: const EdgeInsets.only(left: 10, right: 10),
          padding: const EdgeInsets.symmetric(horizontal: 18),
          decoration: BoxDecoration(
            color: active ? (label == 'Dashboard' ? _mint : Colors.white) : Colors.transparent,
            border: active && label == 'Dashboard' ? const Border(left: BorderSide(color: _primary, width: 5)) : null,
            borderRadius: BorderRadius.circular(label == 'Dashboard' ? 0 : 28),
          ),
          child: Row(
            children: [
              Icon(icon, color: active ? _primary : _textMuted, size: 26),
              const SizedBox(width: 18),
              Expanded(child: Text(label, style: TextStyle(color: active ? _primary : _textMuted, fontSize: 17, fontWeight: FontWeight.w800))),
            ],
          ),
        ),
      ),
    );
  }
}

class SourceTopBar extends StatelessWidget {
  const SourceTopBar({super.key, required this.role, required this.wide, required this.onRoleChanged});

  final DashboardRole role;
  final bool wide;
  final ValueChanged<DashboardRole> onRoleChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: wide ? 102 : 136,
      padding: const EdgeInsets.symmetric(horizontal: 56, vertical: 18),
      decoration: const BoxDecoration(
        color: _surface,
        border: Border(bottom: BorderSide(color: Color(0xFFE8E1EA))),
      ),
      child: Row(
        children: [
          if (role == DashboardRole.patient)
            const Text('Aura Health', style: TextStyle(color: _primary, fontSize: 40, fontWeight: FontWeight.w900))
          else
            Expanded(
              child: TextField(
                decoration: InputDecoration(
                  prefixIcon: const Icon(Icons.search, color: _textMuted),
                  hintText: 'Quick patient search...',
                  filled: true,
                  fillColor: Colors.white,
                  contentPadding: const EdgeInsets.symmetric(vertical: 18),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: _line)),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: _line)),
                ),
              ),
            ),
          const Spacer(),
          if (!wide)
            SegmentedButton<DashboardRole>(
              segments: const [
                ButtonSegment(value: DashboardRole.patient, label: Text('Patient')),
                ButtonSegment(value: DashboardRole.doctor, label: Text('Doctor')),
              ],
              selected: {role},
              onSelectionChanged: (value) => onRoleChanged(value.first),
            ),
          const SizedBox(width: 20),
          CircleAvatar(
            backgroundColor: role == DashboardRole.doctor ? const Color(0xFFE6E0FF) : Colors.transparent,
            child: const Icon(Icons.notifications_none, color: _textMuted),
          ),
          const SizedBox(width: 20),
          if (role == DashboardRole.patient) const PatientAccountMenu(),
        ],
      ),
    );
  }
}

class PatientAccountMenu extends StatelessWidget {
  const PatientAccountMenu({super.key});

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      tooltip: 'Open account menu',
      offset: const Offset(0, 44),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      color: Colors.white,
      onSelected: (value) {
        if (value == 'profile') BrowserNavigation.go('/patient/profile.html');
        if (value == 'logout') BrowserNavigation.go('/api/auth/logout');
      },
      itemBuilder: (context) => const [
        PopupMenuItem(
          value: 'profile',
          child: Row(
            children: [
              Icon(Icons.person_outline, color: _textMuted),
              SizedBox(width: 12),
              Text('Profile', style: TextStyle(color: _navy, fontWeight: FontWeight.w700)),
            ],
          ),
        ),
        PopupMenuItem(
          value: 'logout',
          child: Row(
            children: [
              Icon(Icons.logout, color: _primary),
              SizedBox(width: 12),
              Text('Logout', style: TextStyle(color: _primary, fontWeight: FontWeight.w700)),
            ],
          ),
        ),
      ],
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: Color(0xFFFFD9DE),
            child: Text('S', style: TextStyle(color: _primary, fontWeight: FontWeight.w900)),
          ),
          SizedBox(width: 10),
          Text('Sarah', style: TextStyle(color: _primary, fontSize: 18, fontWeight: FontWeight.w800)),
          SizedBox(width: 4),
          Icon(Icons.keyboard_arrow_down, color: _primary),
        ],
      ),
    );
  }
}

class PatientDashboard extends StatelessWidget {
  const PatientDashboard({super.key, required this.data});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    return DashboardScroll(
      maxWidth: 1180,
      children: [
        SourceHero(
          title: 'Hello, Sarah',
          subtitle: 'You have a busy health week ahead. Stay mindful and hydrated.',
        ),
        Wrap(
          spacing: 30,
          runSpacing: 30,
          children: [
            SizedBox(
              width: MediaQuery.sizeOf(context).width > 1200 ? 760 : double.infinity,
              child: UpcomingAppointmentCard(),
            ),
            SizedBox(
              width: MediaQuery.sizeOf(context).width > 1200 ? 370 : double.infinity,
              child: const InsightCard(),
            ),
          ],
        ),
        Wrap(
          spacing: 30,
          runSpacing: 30,
          children: const [
            SizedBox(width: 540, child: SourceListPanel(title: 'Recent Prescriptions', action: 'VIEW ALL', items: [
              SourceListItem(icon: Icons.medication_outlined, color: _mint, title: 'Iron Supplement Forte', subtitle: '1 pill daily - 20 days left', trailingIcon: Icons.download),
              SourceListItem(icon: Icons.link, color: _mint, title: 'Prenatal Multi-Vitamin', subtitle: 'Morning after food', trailingIcon: Icons.download),
            ])),
            SizedBox(width: 540, child: SourceListPanel(title: 'Recent Reports', action: 'VIEW ALL', items: [
              SourceListItem(icon: Icons.manage_search, color: Color(0xFFEBDCFF), title: 'Full Blood Count', subtitle: 'Uploaded 2 days ago', chip: 'NORMAL', trailingIcon: Icons.visibility_outlined),
              SourceListItem(icon: Icons.assignment_outlined, color: Color(0xFFEBDCFF), title: 'Pelvic Ultrasound Scan', subtitle: 'Uploaded 1 week ago', chip: 'REVIEWED', trailingIcon: Icons.visibility_outlined),
            ])),
          ],
        ),
        const AppointmentHistoryPanel(),
      ],
    );
  }
}

class DoctorDashboard extends StatelessWidget {
  const DoctorDashboard({super.key, required this.data});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    return DashboardScroll(
      maxWidth: 1250,
      children: [
        const DoctorHeader(),
        Wrap(
          spacing: 30,
          runSpacing: 30,
          children: const [
            SizedBox(width: 390, child: DoctorStatCard(icon: Icons.calendar_month, label: "Today's Appointments", value: '12', tag: 'Today', footer: '85% capacity filled', accent: _teal)),
            SizedBox(width: 390, child: DoctorStatCard(icon: Icons.note_alt_outlined, label: 'Pending Prescriptions', value: '04', tag: 'Urgent', footer: 'Requires immediate review', accent: _primary)),
            SizedBox(width: 390, child: DoctorStatCard(icon: Icons.task_alt, label: 'Consultations Done', value: '08', tag: 'Complete', footer: '66% of daily goal', accent: Color(0xFF5B2CBF))),
          ],
        ),
        Wrap(
          spacing: 30,
          runSpacing: 30,
          crossAxisAlignment: WrapCrossAlignment.start,
          children: const [
            SizedBox(width: 815, child: TodaySchedulePanel()),
            SizedBox(width: 390, child: RecentUpdatesPanel()),
          ],
        ),
      ],
    );
  }
}

class DashboardScroll extends StatelessWidget {
  const DashboardScroll({super.key, required this.children, required this.maxWidth});

  final List<Widget> children;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(56, 34, 56, 56),
      itemCount: children.length,
      separatorBuilder: (_, _) => const SizedBox(height: 30),
      itemBuilder: (context, index) => Center(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxWidth),
          child: children[index],
        ),
      ),
    );
  }
}

class SourceHero extends StatelessWidget {
  const SourceHero({super.key, required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(color: _navy, fontSize: 48, fontWeight: FontWeight.w900)),
        const SizedBox(height: 12),
        Text(subtitle, style: const TextStyle(color: _textMuted, fontSize: 23)),
      ],
    );
  }
}

class UpcomingAppointmentCard extends StatelessWidget {
  const UpcomingAppointmentCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: sourceCard(leftAccent: _teal),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const StatusPill(text: 'UPCOMING APPOINTMENT', color: _mint, textColor: _teal),
              const Spacer(),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: const [
                  Text('Tomorrow', style: TextStyle(color: _primary, fontSize: 30, fontWeight: FontWeight.w500)),
                  Text('10:00 AM', style: TextStyle(color: _textMuted, fontSize: 18, fontWeight: FontWeight.w700)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Text('Dr. Elena Rossi', style: TextStyle(color: _navy, fontSize: 30, fontWeight: FontWeight.w900)),
          const Text('Senior Gynecological Specialist', style: TextStyle(color: _textMuted, fontSize: 20)),
          const SizedBox(height: 28),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(color: _panel, borderRadius: BorderRadius.circular(8)),
            child: const Row(
              children: [
                Icon(Icons.location_on_outlined, color: _teal),
                SizedBox(width: 20),
                Expanded(child: Text('Aura Boutique Clinic, Wing A, Room 402', style: TextStyle(color: _navy, fontSize: 18))),
              ],
            ),
          ),
          const SizedBox(height: 28),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              FilledButton(onPressed: () {}, style: FilledButton.styleFrom(backgroundColor: _primary), child: const Text('Prepare for Visit')),
              OutlinedButton(onPressed: () {}, child: const Text('Reschedule')),
            ],
          ),
        ],
      ),
    );
  }
}

class InsightCard extends StatelessWidget {
  const InsightCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 322,
      padding: const EdgeInsets.all(30),
      decoration: BoxDecoration(color: const Color(0xFFD81B60), borderRadius: BorderRadius.circular(10)),
      child: Stack(
        children: [
          const Positioned(right: -22, bottom: -18, child: Icon(Icons.favorite_border, color: Color(0x33FFFFFF), size: 116)),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              Text('Weekly Insight', style: TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.w900)),
              SizedBox(height: 16),
              Text('Maintain a steady iron intake supports your reproductive health during this phase.', style: TextStyle(color: Colors.white, fontSize: 20, height: 1.35)),
              Spacer(),
              Text('Read more', style: TextStyle(color: Colors.white, decoration: TextDecoration.underline, fontSize: 18, fontWeight: FontWeight.w900)),
            ],
          ),
        ],
      ),
    );
  }
}

class SourceListPanel extends StatelessWidget {
  const SourceListPanel({super.key, required this.title, required this.action, required this.items});

  final String title;
  final String action;
  final List<SourceListItem> items;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(30),
      decoration: sourceCard(),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(child: Text(title, style: const TextStyle(color: _navy, fontSize: 30, fontWeight: FontWeight.w900))),
              Text(action, style: const TextStyle(color: _primary, fontWeight: FontWeight.w900)),
            ],
          ),
          const SizedBox(height: 26),
          ...items,
        ],
      ),
    );
  }
}

class SourceListItem extends StatelessWidget {
  const SourceListItem({super.key, required this.icon, required this.color, required this.title, required this.subtitle, this.chip, this.trailingIcon});

  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final String? chip;
  final IconData? trailingIcon;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: _surface, borderRadius: BorderRadius.circular(8)),
      child: Row(
        children: [
          CircleAvatar(radius: 26, backgroundColor: color, child: Icon(icon, color: color == _mint ? _teal : const Color(0xFF572E99))),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: _navy, fontSize: 18, fontWeight: FontWeight.w900)),
                Text(subtitle, style: const TextStyle(color: _textMuted, fontSize: 16)),
              ],
            ),
          ),
          if (chip != null) StatusPill(text: chip!, color: chip == 'NORMAL' ? _mint : const Color(0xFFE6E0FF), textColor: chip == 'NORMAL' ? _teal : _textMuted),
          if (trailingIcon != null) ...[
            const SizedBox(width: 12),
            Icon(trailingIcon, color: _textMuted),
          ],
        ],
      ),
    );
  }
}

class AppointmentHistoryPanel extends StatelessWidget {
  const AppointmentHistoryPanel({super.key});

  @override
  Widget build(BuildContext context) {
    const rows = [
      ['Prenatal Consultation', 'Dr. Elena Rossi', '12 Oct, 2024', 'COMPLETED'],
      ['Pelvic Ultrasound', 'Dr. Sarah Jenkins', '04 Oct, 2024', 'COMPLETED'],
      ['Routine Checkup', 'Dr. Maya Patel', '22 Sep, 2024', 'COMPLETED'],
    ];
    return Container(
      decoration: sourceCard(),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(30),
            child: Row(
              children: const [
                Expanded(child: Text('Appointment History', style: TextStyle(color: _navy, fontSize: 30, fontWeight: FontWeight.w900))),
                Icon(Icons.filter_list, color: _textMuted),
                SizedBox(width: 8),
                Text('Filter History', style: TextStyle(color: _textMuted, fontSize: 18)),
              ],
            ),
          ),
          Container(
            color: const Color(0xFFE0E0FF),
            padding: const EdgeInsets.symmetric(horizontal: 30, vertical: 18),
            child: const Row(children: [
              Expanded(child: Text('SERVICE', style: tableHead)),
              Expanded(child: Text('DOCTOR', style: tableHead)),
              Expanded(child: Text('DATE', style: tableHead)),
              Expanded(child: Text('STATUS', style: tableHead)),
              Text('ACTION', style: tableHead),
            ]),
          ),
          ...rows.map((row) => Padding(
                padding: const EdgeInsets.symmetric(horizontal: 30, vertical: 18),
                child: Row(children: [
                  Expanded(child: Text(row[0], style: tableCell)),
                  Expanded(child: Text(row[1], style: tableCell)),
                  Expanded(child: Text(row[2], style: const TextStyle(color: _textMuted, fontSize: 16))),
                  Expanded(child: Align(alignment: Alignment.centerLeft, child: StatusPill(text: row[3], color: const Color(0xFFE6E0FF), textColor: _textMuted))),
                  const Text('View Details', style: TextStyle(color: _primary, fontWeight: FontWeight.w900)),
                ]),
              )),
        ],
      ),
    );
  }
}

class DoctorHeader extends StatelessWidget {
  const DoctorHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Good Morning, Dr. Rossi', style: TextStyle(color: _navy, fontSize: 40, fontWeight: FontWeight.w900)),
        SizedBox(height: 8),
        Text('You have 12 appointments scheduled for today.', style: TextStyle(color: _textMuted, fontSize: 20)),
      ],
    );
  }
}

class DoctorStatCard extends StatelessWidget {
  const DoctorStatCard({super.key, required this.icon, required this.label, required this.value, required this.tag, required this.footer, required this.accent});

  final IconData icon;
  final String label;
  final String value;
  final String tag;
  final String footer;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 268,
      padding: const EdgeInsets.all(34),
      decoration: sourceCard(leftAccent: accent),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(radius: 29, backgroundColor: accent.withValues(alpha: 0.18), child: Icon(icon, color: accent, size: 30)),
              const Spacer(),
              StatusPill(text: tag, color: accent.withValues(alpha: 0.10), textColor: accent),
            ],
          ),
          const Spacer(),
          Text(label, style: const TextStyle(color: _textMuted, fontSize: 17)),
          const SizedBox(height: 16),
          Text(value, style: const TextStyle(color: _navy, fontSize: 54, fontWeight: FontWeight.w900)),
          const SizedBox(height: 10),
          Text(footer, style: TextStyle(color: accent, fontSize: 15, fontWeight: FontWeight.w900)),
        ],
      ),
    );
  }
}

class TodaySchedulePanel extends StatelessWidget {
  const TodaySchedulePanel({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(30),
      decoration: sourceCard(),
      child: Column(
        children: [
          Row(
            children: const [
              Expanded(child: Text("Today's Schedule", style: TextStyle(color: _navy, fontSize: 30, fontWeight: FontWeight.w900))),
              Text('View Full Calendar', style: TextStyle(color: _primary, fontWeight: FontWeight.w900, fontSize: 16)),
              Icon(Icons.chevron_right, color: _primary),
            ],
          ),
          const SizedBox(height: 28),
          const ScheduleRow(time: '09:30\nAM', label: 'Ongoing Consultation', patient: 'Sarah Mitchell', detail: 'Prenatal Checkup - Week 24', chip: 'In Progress', active: true),
          const ScheduleRow(time: '10:15\nAM', label: 'Next Visit', patient: 'Amanda K. Reed', detail: 'Diagnostic Ultrasound Review', chip: 'Scheduled'),
          const ScheduleRow(time: '11:00\nAM', label: 'Follow-up', patient: 'Dr. Sofia Chen (Referral)', detail: 'Post-Op Recovery Evaluation', chip: 'New Patient'),
          const ScheduleRow(time: '12:30\nPM', label: 'Lunch Break / Admin Work', patient: '', detail: 'Clinic Level 2 Cafeteria', muted: true),
        ],
      ),
    );
  }
}

class ScheduleRow extends StatelessWidget {
  const ScheduleRow({super.key, required this.time, required this.label, required this.patient, required this.detail, this.chip, this.active = false, this.muted = false});

  final String time;
  final String label;
  final String patient;
  final String detail;
  final String? chip;
  final bool active;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 78, child: Text(time, textAlign: TextAlign.right, style: TextStyle(color: active ? _primary : _textMuted, fontWeight: active ? FontWeight.w900 : FontWeight.w500, height: 1.4))),
          const SizedBox(width: 22),
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                color: active ? const Color(0xFFE2FAF7) : muted ? _panel : _surface,
                border: Border.all(color: active ? _mint : _line),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(label, style: TextStyle(color: active ? _teal : _textMuted, fontSize: 18, fontStyle: muted ? FontStyle.italic : FontStyle.normal)),
                        if (patient.isNotEmpty) Text(patient, style: const TextStyle(color: _navy, fontSize: 20, fontWeight: FontWeight.w900)),
                        Text(detail, style: TextStyle(color: _textMuted, fontSize: 16, fontStyle: muted ? FontStyle.italic : FontStyle.normal)),
                      ],
                    ),
                  ),
                  if (chip != null) StatusPill(text: chip!, color: active ? _teal : const Color(0xFFE6E0FF), textColor: active ? Colors.white : _textMuted),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class RecentUpdatesPanel extends StatelessWidget {
  const RecentUpdatesPanel({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(30),
      decoration: sourceCard(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Recent Updates', style: TextStyle(color: _navy, fontSize: 30, fontWeight: FontWeight.w900)),
          const SizedBox(height: 24),
          const UpdateItem(icon: Icons.cloud_upload_outlined, color: Color(0xFFFFD9DE), title: 'Lab Reports Uploaded', body: 'New bloodwork results available for Beatrice Vance.', time: '12 mins ago'),
          const UpdateItem(icon: Icons.add_task, color: _mint, title: 'New Booking', body: 'Emergency consult requested by Clara Oswald for tomorrow at 08:00 AM.', time: '45 mins ago'),
          const UpdateItem(icon: Icons.mail_outline, color: Color(0xFFEBDCFF), title: 'Internal Message', body: 'Dr. Jameson shared a case file regarding the robotic surgery scheduled for Friday.', time: '2 hours ago'),
          const SizedBox(height: 14),
          SizedBox(width: double.infinity, height: 52, child: OutlinedButton(onPressed: () {}, child: const Text('Mark All as Read'))),
        ],
      ),
    );
  }
}

class UpdateItem extends StatelessWidget {
  const UpdateItem({super.key, required this.icon, required this.color, required this.title, required this.body, required this.time});

  final IconData icon;
  final Color color;
  final String title;
  final String body;
  final String time;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 18),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Color(0x22E3BDC3)))),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(radius: 25, backgroundColor: color, child: Icon(icon, color: _primary)),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: _navy, fontSize: 17, fontWeight: FontWeight.w900)),
                Text(body, style: const TextStyle(color: _textMuted, fontSize: 16, height: 1.35)),
                const SizedBox(height: 6),
                Text(time, style: const TextStyle(color: _textMuted, fontWeight: FontWeight.w900)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class StatusPill extends StatelessWidget {
  const StatusPill({super.key, required this.text, required this.color, required this.textColor});

  final String text;
  final Color color;
  final Color textColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(18)),
      child: Text(text, style: TextStyle(color: textColor, fontSize: 13, fontWeight: FontWeight.w900, letterSpacing: 0.5)),
    );
  }
}

BoxDecoration sourceCard({Color? leftAccent}) {
  return BoxDecoration(
    color: Colors.white,
    borderRadius: BorderRadius.circular(12),
    border: Border.all(color: _line),
    boxShadow: const [BoxShadow(color: Color(0x10000767), blurRadius: 28, offset: Offset(0, 12))],
  ).copyWith(
    border: Border(
      left: BorderSide(color: leftAccent ?? _line, width: leftAccent == null ? 1 : 4),
      top: const BorderSide(color: _line),
      right: const BorderSide(color: _line),
      bottom: const BorderSide(color: _line),
    ),
  );
}

const tableHead = TextStyle(color: _textMuted, fontWeight: FontWeight.w900, letterSpacing: 1.2);
const tableCell = TextStyle(color: _navy, fontSize: 16, fontWeight: FontWeight.w600);

class BrowserNavigation {
  static Future<void> go(String path) async {
    await launchUrl(Uri.parse(path), webOnlyWindowName: '_self');
  }
}

Map<String, dynamic> dummyData(DashboardRole role) => {};
