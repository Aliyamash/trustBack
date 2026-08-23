import fs from "node:fs";
import path from "node:path";

const team = [
  { name: "Maziar Dehghani", position: "Software Engineer", bio: "Transforms ideas into functional and efficient code, ensuring every project runs smoothly with clean structure and smart solutions.", image: "team/maziarnew.jpg", github: "https://github.com/maziardehghani" },
  { name: "Ali Ashrafi", position: "Software Engineer", bio: "One of the agency’s most skilled programmers, combining creative design with technical expertise to build unique and animated experiences.", image: "team/alinew.jpg", github: "https://github.com/Aliyamash", linkedin: "https://www.linkedin.com/in/ali-ashrafi-b24943299" },
  { name: "Mohammad Shekarchian", position: "Marketing Specialist", bio: "A key part of the marketing team, leading campaign strategies, analyzing results, and helping the brand connect with the right audience.", image: "team/mmdnew.jpg" },
  { name: "Sina Norozi", position: "Marketing Assistant", bio: "Works closely with the marketing team to manage social media, create engaging content, and support customer acquisition efforts.", image: "team/sina.jpg" },
  { name: "Elias Kiloua", position: "Graphic Designer", bio: "Brings ideas to life through modern, user-focused design and visually compelling concepts that strengthen the brand’s identity.", image: "team/elias.jpg" },
  { name: "Arian Shahrestani", position: "Strategic Partner", bio: "As the Strategic Partner at Trustence, he works closely with the team to support business direction, build valuable collaborations, and help the agency move forward with confidence and clarity.", image: "team/arian.jpg" },
  { name: "Javad Mostatabi", position: "Visual Content Creator", bio: "A creative Video Editor who turns raw footage into engaging stories through strong pacing, music, and smooth transitions. Detail-oriented and message-focused, he delivers polished videos that capture the audience’s attention.", image: "team/jawad.png" },
];

const projects = [
  { title: "Animated Portfolio Website", category: "Web Design / Portfolio", intro: "A clean, animated portfolio showcasing work with modern design and smooth interactions.", link: "https://ali-ashrafi.vercel.app/", image: "portfolio.png", tags: "Web Design,Portfolio,Animation" },
  { title: "Creative Portfolio & Shop Website", category: "Portfolio / E-commerce / Web Design", intro: "A stylish hybrid website that showcases work while offering products for sale, built with modern layouts and creative visual elements.", link: "https://ali-ashrafi.vercel.app/", image: "shahriarh.png", tags: "Portfolio,E-commerce,Web Design" },
];

function copyAsset(assetDir, uploadDir, relativeSource, targetName) {
  const source = path.resolve(assetDir, relativeSource);
  const target = path.resolve(uploadDir, targetName);
  if (!source.startsWith(path.resolve(assetDir)) || !target.startsWith(path.resolve(uploadDir))) {
    throw new Error("Invalid seed asset path");
  }
  if (!fs.existsSync(source)) throw new Error(`Seed image not found: ${source}`);
  if (!fs.existsSync(target)) fs.copyFileSync(source, target);
  return `/uploads/${targetName}`;
}

export function seedDefaultContent(db, { uploadDir, seedAssetDir }) {
  fs.mkdirSync(uploadDir, { recursive: true });
  const teamCount = Number(db.prepare("SELECT COUNT(*) AS count FROM team_members").get().count);
  const projectCount = Number(db.prepare("SELECT COUNT(*) AS count FROM projects").get().count);
  let teamAdded = 0;
  let projectsAdded = 0;

  if (teamCount === 0) {
    const insert = db.prepare(`INSERT INTO team_members
      (name, position, bio, profile, github, twitter, linkedin, sort_order, is_published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`);
    team.forEach((member, index) => {
      const extension = path.extname(member.image);
      const profile = copyAsset(seedAssetDir, uploadDir, member.image, `seed-team-${index + 1}${extension}`);
      insert.run(member.name, member.position, member.bio, profile, member.github || null, null, member.linkedin || null, index + 1);
      teamAdded += 1;
    });
  }

  if (projectCount === 0) {
    const insert = db.prepare(`INSERT INTO projects
      (title, category_name, intro, description, link, banner, tags, is_published)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)`);
    projects.forEach((project, index) => {
      const extension = path.extname(project.image);
      const banner = copyAsset(seedAssetDir, uploadDir, project.image, `seed-project-${index + 1}${extension}`);
      insert.run(project.title, project.category, project.intro, project.intro, project.link, banner, project.tags);
      projectsAdded += 1;
    });
  }

  return { teamAdded, projectsAdded };
}
