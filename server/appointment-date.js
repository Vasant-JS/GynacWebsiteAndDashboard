const dateKey=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
function isPastAppointmentDate(value,now=new Date()){return dateKey(value)<dateKey(now);}
module.exports={isPastAppointmentDate};
