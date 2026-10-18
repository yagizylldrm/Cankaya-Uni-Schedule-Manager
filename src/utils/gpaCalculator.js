const GRADES = { AA:4.0, BA:3.5, BB:3.0, CB:2.5, CC:2.0, DC:1.5, DD:1.0, FD:0.5, FF:0.0, NA:0.0 };
export const calculateGpa = (courses) => {
  const pts = courses.reduce((s,c)=>(s + (c.credits||0)*GRADES[c.grade]),0);
  const cred = courses.reduce((s,c)=>s+(c.credits||0),0);
  return cred ? pts/cred : 0;
};
export const simulateNewCgpa = ({pastCompletedCredits,pastTotalPoints,pastCourses=[],currentCourses=[]}) => {
  const retakeCodes = new Set(pastCourses.map(c=>c.courseCode));
  let pts = pastTotalPoints, cred = pastCompletedCredits;
  currentCourses.forEach(c => {
    if (retakeCodes.has(c.courseCode) && pastCourses.find(p=>p.courseCode===c.courseCode)) {
      const old = pastCourses.find(p=>p.courseCode===c.courseCode);
      pts -= (old.credits||0)*GRADES[old.grade];
      cred -= (old.credits||0);
    }
    pts += (c.credits||0)*GRADES[c.grade];
    cred += (c.credits||0);
  });
  return { newCgpa: cred?pts/cred:0, termGpa: calculateGpa(currentCourses) };
};
