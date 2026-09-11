# 🤝 Contributing to N-Health

Thank you for your interest in contributing to N-Health! This guide will help you get started.

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for all. We expect all members to:

- Use welcoming and inclusive language
- Be respectful of differing opinions and backgrounds
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

### Unacceptable Behavior

The following behaviors are considered harassment and are unacceptable:

- The use of sexualized language or imagery
- Personal attacks or derogatory comments
- Trolling or insulting comments
- Deliberate intimidation or threats
- Unwelcome sexual attention
- Discrimination based on race, gender, religion, disability, etc.

### Enforcement

Violations should be reported to the core team. All complaints will be reviewed and investigated promptly and fairly. The team reserves the right to remove any contributor who violates this code.

---

## Getting Started

### Prerequisites

- Node.js 20+ (use `.tool-versions` for exact versions)
- PostgreSQL 16+
- Git

### Local Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/AbuBkrrr/NHealth.git
   cd n-health
   ```

2. **Install dependencies**
   ```bash
   # Backend
   cd backend
   npm install

   # Frontend
   cd ../admin-web
   npm install
   ```

3. **Configure environment**
   ```bash
   # Backend
   cd backend
   cp .env.example .env
   # Edit .env with your settings

   # Frontend
   cd ../admin-web
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Start development server**
   ```bash
   # Backend (terminal 1)
   cd backend
   npm run dev

   # Frontend (terminal 2)
   cd admin-web
   npm run dev

   # Database GUI (terminal 3)
   cd backend
   npm run prisma:studio
   ```

5. **Verify setup**
   - Backend: http://localhost:4000/health
   - Frontend: http://localhost:5173
   - Database: http://localhost:5555

---

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

Use descriptive branch names:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation
- `refactor/` - Code refactoring
- `test/` - Tests

### 2. Make Changes

Follow the code style:

**Backend (Express.js/TypeScript)**:
- Use async/await (no callbacks)
- Validate input with Zod
- Return descriptive error messages
- Add JSDoc comments on public functions
- Use named exports

**Frontend (React/TypeScript)**:
- Use functional components with hooks
- Extract reusable components
- Use proper TypeScript types
- Keep components under 300 lines
- Add comments for complex logic

### 3. Commit Messages

Use clear, concise commit messages:

```
[category] Short description

Optional longer explanation if needed.

Example:
[feat] Add rate limiting to auth endpoints
[fix] Handle missing user profile in login
[docs] Update deployment guide
[test] Add tests for ImageOptimizationService
```

Categories:
- `[feat]` - New feature
- `[fix]` - Bug fix
- `[docs]` - Documentation
- `[test]` - Tests
- `[refactor]` - Code cleanup
- `[perf]` - Performance improvement
- `[chore]` - Maintenance

### 4. Commit & Push

```bash
git add .
git commit -m "[feat] Your feature description"
git push origin feature/your-feature-name
```

### 5. Create Pull Request

On GitHub:

1. Click "New Pull Request"
2. Select your branch
3. Fill in the PR template:

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] New feature
- [ ] Bug fix
- [ ] Documentation update
- [ ] Performance improvement

## Testing
How did you test this change?

## Screenshots (if applicable)
Include screenshots for UI changes.

## Checklist
- [ ] Code follows style guide
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes
```

### 6. Review & Merge

- At least one maintainer review required
- All CI checks must pass
- Address review comments
- Maintainer merges when approved

---

## Code Style Guide

### TypeScript

```typescript
// ✅ Good
async function getUserById(userId: string): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  return user;
}

// ❌ Bad
function getUserById(userId) {
  return db.query(`SELECT * FROM users WHERE id = ?`, [userId]);
}
```

### Error Handling

```typescript
// ✅ Good - Use ApiError
if (!user) {
  throw new ApiError(404, 'User not found');
}

// ❌ Bad - Generic error
if (!user) {
  throw new Error('error');
}
```

### Validation

```typescript
// ✅ Good - Zod schema
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// ❌ Bad - Ad-hoc validation
if (!email.includes('@')) throw new Error('Invalid email');
```

### React Components

```typescript
// ✅ Good
interface UserCardProps {
  userId: string;
  onDelete: (id: string) => void;
}

export const UserCard: React.FC<UserCardProps> = ({ userId, onDelete }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    loadUser(userId);
  }, [userId]);

  return (
    <div className="user-card">
      {user && <h3>{user.name}</h3>}
    </div>
  );
};

// ❌ Bad
export const UserCard = (props) => {
  const [data, setData] = useState(null);
  // ... no types
};
```

---

## Testing Requirements

Tests are currently being added. When contributing:

1. **Write tests** for new features
2. **Update tests** for modified code
3. **Ensure tests pass** before pushing

```bash
cd backend
npm run test

cd ../admin-web
npm run test
```

---

## Documentation Requirements

Update documentation for:
- New features
- API changes
- Configuration changes
- Environment variables

Files to update:
- `README.md` - Overview
- `SECURITY.md` - Security changes
- `docs/` folder - Architecture, deployment guides
- Code comments - Complex logic

---

## Performance Considerations

When contributing, consider:

- **API response times**: Aim for <200ms
- **Bundle size**: Keep frontend bundle under 500KB gzipped
- **Database queries**: Use indexing, avoid N+1 queries
- **Memory usage**: Avoid memory leaks in event listeners
- **Network requests**: Batch requests where possible

---

## Accessibility (A11y)

For UI changes:

- ✅ Use semantic HTML (`<button>`, `<nav>`, `<main>`)
- ✅ Add `alt` text to images
- ✅ Ensure keyboard navigation works
- ✅ Maintain sufficient color contrast
- ✅ Use ARIA labels where needed

```jsx
// ✅ Good
<button aria-label="Close menu" onClick={closeMenu}>
  ✕
</button>

// ❌ Bad
<div onClick={closeMenu}>X</div>
```

---

## Mobile Responsiveness

For UI changes:

- ✅ Test on mobile (375px, 768px, 1024px viewports)
- ✅ Use responsive design patterns
- ✅ Touch-friendly target sizes (min 48x48px)
- ✅ Consider slow network conditions

---

## Security Guidelines

When contributing:

- ✅ Never hardcode secrets or API keys
- ✅ Validate all user input
- ✅ Use parameterized queries (Prisma ORM)
- ✅ Don't log sensitive data
- ✅ Use HTTPS in production
- ✅ Follow principle of least privilege

See [SECURITY.md](SECURITY.md) for details.

---

## Need Help?

- **Questions?** Open a Discussion on GitHub
- **Bug found?** Open an Issue with reproduction steps
- **Feature idea?** Start a Discussion
- **Security concern?** Email security@nhealth.dev

---

## Recognition

Contributors will be listed in:
- `CONTRIBUTORS.md`
- GitHub contributors graph
- Release notes

---

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

**Thank you for contributing to N-Health! 🙏**
