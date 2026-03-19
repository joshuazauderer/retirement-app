export default function SecurityPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-900 mb-4">Security</h1>
      <p className="text-slate-600 leading-relaxed mb-8">
        We take the security of your financial data seriously. Here&apos;s how we protect it.
      </p>
      <div className="space-y-6">
        {[
          {
            title: "Encryption in Transit",
            body: "All communication between your browser and our servers is encrypted using TLS 1.3.",
          },
          {
            title: "Encryption at Rest",
            body: "Your financial data is encrypted at rest in our database using industry-standard encryption.",
          },
          {
            title: "Authentication",
            body: "We use secure session management with Auth.js. Passwords are hashed using bcrypt and never stored in plaintext.",
          },
          {
            title: "Access Controls",
            body: "Role-based access controls ensure that collaborators can only access the data you explicitly share with them.",
          },
          {
            title: "Security Headers",
            body: "All responses include security headers including X-Frame-Options, X-Content-Type-Options, and a strict Referrer-Policy.",
          },
        ].map(({ title, body }) => (
          <div key={title} className="flex gap-4">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">{title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm text-slate-500">
        Found a security issue? Please report it responsibly to security@retireplan.app.
      </p>
    </div>
  );
}
