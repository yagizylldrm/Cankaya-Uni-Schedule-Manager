const GRADES = { AA:4.0, BA:3.5, BB:3.0, CB:2.5, CC:2.0, DC:1.5, DD:1.0, FD:0.5, FF:0.0, NA:0.0 };
export const calculateGpa = (courses) => {
  const pts = courses.reduce((s,c)=>(s + (c.credits||0)*GRADES[c.grade]),0);
  const cred = courses.reduce((s,c)=>s+(c.credits||0),0);
  return cred ? pts/cred : 0;
};
export const simulateNewCgpa = ({pastCompletedCredits,pastTotalPoints,pastCourses=[],currentCourses=[]}) => {
  let pts = Number(pastTotalPoints) || 0;
  let cred = Number(pastCompletedCredits) || 0;
  const retaken = new Set();
  for (const course of currentCourses) {
    const code = course.courseCode.trim().toUpperCase();
    const old = code && !retaken.has(code) && pastCourses.find(p => p.courseCode.trim().toUpperCase() === code);
    if (old) {
      pts -= old.credits * GRADES[old.grade];
      cred -= old.credits;
      retaken.add(code);
    }
    pts += course.credits * GRADES[course.grade];
    cred += course.credits;
  }
  return { newCgpa: cred ? pts / cred : 0, termGpa: calculateGpa(currentCourses) };
};
