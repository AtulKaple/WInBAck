import app from './app';
import "./modules/medication/jobs";

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Winsights PatientHub server running on port ${PORT}`);
});
