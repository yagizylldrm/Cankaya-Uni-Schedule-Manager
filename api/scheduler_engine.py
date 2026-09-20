class SchedulerEngine:
    DAYS_ORDER = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]

    @staticmethod
    def slots_overlap(slot1, slot2):
        """Checks if two schedule slots overlap in time."""
        if slot1.day != slot2.day:
            return False
        # If time_slot strings match exactly, they overlap
        if slot1.time_slot == slot2.time_slot:
            return True

        # Try parsing hour ranges e.g. "09:00/09:20" or "09:00-09:50"
        t1_start, t1_end = SchedulerEngine.parse_time_range(slot1.time_slot)
        t2_start, t2_end = SchedulerEngine.parse_time_range(slot2.time_slot)

        if t1_start is not None and t2_start is not None:
            return max(t1_start, t2_start) < min(t1_end, t2_end)

        return False

    @staticmethod
    def parse_time_range(time_str):
        """Parses time string like '09:00/09:20' or '09:00-09:50' into float hours e.g. (9.0, 9.33)."""
        try:
            cleaned = time_str.replace('/', '-').strip()
            parts = cleaned.split('-')
            if len(parts) == 2:
                h1, m1 = map(int, parts[0].split(':'))
                h2, m2 = map(int, parts[1].split(':'))
                
                start_val = h1 + m1 / 60.0
                end_val = h2 + m2 / 60.0

                # Çankaya timetable quirk: "09:00/09:20" actually represents the 09:00-09:50 period.
                # If duration is only 20 mins, expand to standard 50-min period slot
                if end_val - start_val < 0.5:
                    end_val = start_val + (50.0 / 60.0)

                return start_val, end_val
        except Exception:
            pass
        return None, None

    @staticmethod
    def sections_overlap(sec1, sec2):
        """Checks if two sections have any overlapping schedule slots."""
        for slot1 in sec1.slots:
            for slot2 in sec2.slots:
                if SchedulerEngine.slots_overlap(slot1, slot2):
                    return True, slot1
        return False, None

    @staticmethod
    def slot_overlaps_custom_block(slot, block):
        """Checks if a course slot overlaps with a student's custom block."""
        if slot.day != block.get("day"):
            return False
        b_slot = block.get("time_slot", "")
        if slot.time_slot == b_slot:
            return True

        t1_start, t1_end = SchedulerEngine.parse_time_range(slot.time_slot)
        t2_start, t2_end = SchedulerEngine.parse_time_range(b_slot)

        if t1_start is not None and t2_start is not None:
            return max(t1_start, t2_start) < min(t1_end, t2_end)

        # Fallback: check if start hour matches (e.g. "10:00")
        s1 = slot.time_slot.strip()[:5]
        s2 = b_slot.strip()[:5]
        if s1 and s2 and s1 == s2:
            return True

        return False

    @staticmethod
    def section_overlaps_custom_blocks(sec, custom_blocks):
        """
        Checks if a section has any slot overlapping with any custom schedule block.
        Returns: (bool, (slot, block) or None)
        """
        if not custom_blocks:
            return False, None
        for slot in sec.slots:
            for block in custom_blocks.values():
                if SchedulerEngine.slot_overlaps_custom_block(slot, block):
                    return True, (slot, block)
        return False, None

    @staticmethod
    def find_all_conflicts(sections_list, custom_blocks=None):
        """
        Takes a list of Section objects and optional custom_blocks dict.
        Returns all conflicting slot details.
        Returns dict of format: { (day, time_slot): { "sections": [...], "custom_block": block_or_None } }
        """
        slot_map = {}
        for sec in sections_list:
            for slot in sec.slots:
                key = (slot.day, slot.time_slot)
                if key not in slot_map:
                    slot_map[key] = []
                slot_map[key].append(sec)

        conflicts = {}
        for key, sec_list in slot_map.items():
            distinct_courses = set(sec.course_code for sec in sec_list)
            day, time_str = key
            
            # Check if this slot also collides with a custom block
            block_clash = None
            if custom_blocks:
                for block in custom_blocks.values():
                    if block.get("day") == day:
                        t1_start, t1_end = SchedulerEngine.parse_time_range(time_str)
                        t2_start, t2_end = SchedulerEngine.parse_time_range(block.get("time_slot", ""))
                        if t1_start is not None and t2_start is not None:
                            if max(t1_start, t2_start) < min(t1_end, t2_end):
                                block_clash = block
                                break
                        elif time_str == block.get("time_slot", ""):
                            block_clash = block
                            break

            if len(distinct_courses) > 1 or block_clash is not None:
                conflicts[key] = {
                    "sections": sec_list,
                    "custom_block": block_clash
                }

        return conflicts

    def explain_conflicts(self, course_sections_dict, preferences=None, custom_blocks=None):
        """Return concrete conflicts and verified fixes; bound diagnostic work.

        A budget-exhausted search is unknown, never evidence that a fix works.
        """
        from itertools import combinations

        preferences = preferences or {}
        custom_blocks = custom_blocks or {}
        details = []
        budget = [40000]

        def feasible(prefs, blocks):
            candidates = []
            for sections in course_sections_dict.values():
                allowed = [s for s in sections if self.filter_and_rank_combinations([[s]], prefs)
                           and not self.section_overlaps_custom_blocks(s, blocks)[0]]
                if not allowed:
                    return False
                candidates.append(allowed)
            candidates.sort(key=len)

            def search(index, chosen):
                if index == len(candidates):
                    return True
                for section in candidates[index]:
                    if budget[0] <= 0:
                        return None
                    budget[0] -= 1
                    if any(self.sections_overlap(section, other)[0] for other in chosen):
                        continue
                    result = search(index + 1, chosen + [section])
                    if result is not False:
                        return result
                return False

            return search(0, [])

        labels = {"free_friday": "Cuma günü boş", "free_monday": "Pazartesi boş", "no_morning": "Sabah dersi yok"}
        enabled = [key for key in labels if preferences.get(key)]
        # Smallest verified relaxation first, allowing combined constraints.
        for size in range(1, len(enabled) + 1):
            for keys in combinations(enabled, size):
                relaxed = {**preferences, **{key: False for key in keys}}
                if feasible(relaxed, custom_blocks) is True:
                    details.append({"kind": "preferences", "message":
                        f"{', '.join(labels[k] for k in keys)} tercihini kaldırırsanız çakışmasız program oluşturulabilir.",
                        "action": {"type": "relax_preferences", "keys": list(keys), "label": "Tercihi kaldır ve oluştur"}})
            if details:
                break

        for key, block in list(custom_blocks.items())[:10]:
            if feasible(preferences, {k: b for k, b in custom_blocks.items() if k != key}) is True:
                details.append({"kind": "custom_block", "message":
                    f"{block.get('day')} {block.get('time_slot')}: {block.get('title', 'Etkinlik')} kaldırılırsa program oluşturulabilir.",
                    "action": {"type": "remove_block", "key": key, "label": "Etkinliği kaldır ve oluştur"}})

        for (code_a, secs_a), (code_b, secs_b) in combinations(course_sections_dict.items(), 2):
            if not secs_a or not secs_b:
                continue
            unavoidable = True
            example = None
            for a in secs_a:
                for b in secs_b:
                    if budget[0] <= 0:
                        unavoidable = False
                        break
                    budget[0] -= 1
                    overlap, slot = self.sections_overlap(a, b)
                    if not overlap:
                        unavoidable = False
                        break
                    example = example or (a, b, slot)
                if not unavoidable:
                    break
            if unavoidable and example:
                a, b, slot = example
                details.append({"kind": "course_pair", "message":
                    f"{code_a} ve {code_b} için seçtiğiniz şubelerin her eşleşmesi çakışıyor. "
                    f"Örnek: şube {a.section_no} / {b.section_no}, {slot.day} {slot.time_slot}.",
                    "action": {"type": "review_basket", "label": "Sepette şubeleri değiştir"}})
            if len(details) >= 8:
                break

        if not details:
            details.append({"kind": "combined", "message":
                "Ders, şube, tercih ve etkinlik kısıtları birlikte uygun bir program bırakmıyor. "
                "Sepetten farklı şubeler seçin veya birden fazla tercihi esnetin.",
                "action": {"type": "review_basket", "label": "Ders sepetini incele"}})
        return details[:8]

    def generate_combinations(self, course_sections_dict, preferences=None, custom_blocks=None):
        """
        Generates valid non-conflicting section combinations.
        course_sections_dict: { "CENG111": [Section1, Section2, ...], "MATH119": [...] }
        preferences: dict e.g. {"free_friday": True, "no_morning": False}
        custom_blocks: dict of user-defined schedule blocks e.g. { "Pazartesi:10:00 - 10:50": {...} }
        
        Returns: list of combinations. Each combination is a list of Section objects.
        """
        course_codes = list(course_sections_dict.keys())
        if not course_codes:
            return []

        # List of lists of candidate sections per course, pruning any section that conflicts with custom blocks
        sections_per_course = []
        for code in course_codes:
            secs = [s for s in course_sections_dict.get(code, [])
                    if self.filter_and_rank_combinations([[s]], preferences or {})]
            if not secs:
                return []

            if custom_blocks:
                valid_secs = [
                    sec for sec in secs
                    if not self.section_overlaps_custom_blocks(sec, custom_blocks)[0]
                ]
                # If ALL sections of this course conflict with custom blocks, no valid combination is possible
                if not valid_secs:
                    return []
                sections_per_course.append(valid_secs)
            else:
                sections_per_course.append(list(secs))

        if not sections_per_course:
            return []

        valid_combinations = []

        def backtrack(course_idx, current_combination):
            if course_idx == len(sections_per_course):
                valid_combinations.append(list(current_combination))
                return

            candidate_sections = sections_per_course[course_idx]
            for sec in candidate_sections:
                # Check conflict with already selected sections
                conflict_found = False
                for existing_sec in current_combination:
                    overlap, _ = self.sections_overlap(sec, existing_sec)
                    if overlap:
                        conflict_found = True
                        break

                if not conflict_found:
                    current_combination.append(sec)
                    backtrack(course_idx + 1, current_combination)
                    current_combination.pop()

        backtrack(0, [])

        # Apply preference filters / sorting if provided
        if preferences:
            valid_combinations = self.filter_and_rank_combinations(valid_combinations, preferences)

        return valid_combinations

    def filter_and_rank_combinations(self, combinations, preferences):
        filtered = []

        free_friday = preferences.get("free_friday", False)
        free_monday = preferences.get("free_monday", False)
        no_morning = preferences.get("no_morning", False)

        for combo in combinations:
            # Days occupied
            days_used = set()
            has_morning = False

            for sec in combo:
                for slot in sec.slots:
                    days_used.add(slot.day)
                    start, _ = self.parse_time_range(slot.time_slot)
                    if start is not None and start < 10.0:
                        has_morning = True

            if free_friday and "Cuma" in days_used:
                continue
            if free_monday and "Pazartesi" in days_used:
                continue
            if no_morning and has_morning:
                continue

            filtered.append(combo)

        # Sort combinations by number of free days (most free days first)
        def score_combination(combo):
            days_used = set()
            for sec in combo:
                for slot in sec.slots:
                    days_used.add(slot.day)
            return len(days_used)

        filtered.sort(key=score_combination)
        return filtered
